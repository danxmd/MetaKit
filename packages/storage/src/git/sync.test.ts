import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { createToolStore, type ToolLibrary } from '@metakit-app/core';
import { sampleTool, sampleWithBehaviour } from './sample-tools';
import { fromLayout, toLayout } from './layout';
import { createGitLinkStore, type GitLink } from './link';
import { applyResolutions, conflictKey, mergeLayouts } from './merge';
import { MemoryRemote } from './memory-remote';
import { NonFastForwardError } from './remote';
import {
  commitPending,
  diffToolCommands,
  finishPull,
  linkFromSnapshot,
  listReleases,
  openRelease,
  pendingChanges,
  pull,
  pullBatch,
} from './sync';

const where = {
  toolSlug: 'bpmn-lite',
  service: 'github' as const,
  host: 'github.com',
  repo: 'me/tools',
  folder: '',
  branch: 'main',
};

const clone = <T>(x: T): T => structuredClone(x);

const taskOf = (tool: ToolLibrary) =>
  Object.values(tool.classes).find((c) => c.key === 'Task')!;

function editTask(
  tool: ToolLibrary,
  fn: (task: ReturnType<typeof taskOf>) => void,
): ToolLibrary {
  const next = clone(tool);
  fn(taskOf(next));
  return next;
}

async function open(
  remote: MemoryRemote,
): Promise<{ tool: ToolLibrary; link: GitLink }> {
  const snapshot = await remote.read('main');
  const loaded = fromLayout(snapshot.files);
  return { tool: loaded.tool!, link: linkFromSnapshot(where, snapshot) };
}

function seeded(): MemoryRemote {
  return new MemoryRemote(toLayout(sampleWithBehaviour()));
}

describe('MemoryRemote', () => {
  it('commits on the head, refuses a stale parent, and reads by branch, tag or commit', async () => {
    const remote = new MemoryRemote([{ path: 'a.txt', content: 'one' }]);
    const first = await remote.head('main');
    const { commit } = await remote.commit({
      branch: 'main',
      parent: first,
      message: 'two',
      changes: [
        { path: 'a.txt', content: 'two' },
        { path: 'b.txt', content: 'b' },
      ],
    });
    await expect(
      remote.commit({
        branch: 'main',
        parent: first,
        message: 'late',
        changes: [],
      }),
    ).rejects.toBeInstanceOf(NonFastForwardError);
    remote.tag('v1');
    await remote.commit({
      branch: 'main',
      parent: commit,
      message: 'three',
      changes: [{ path: 'a.txt', content: null }],
    });
    expect((await remote.read('v1')).files.map((f) => f.path)).toEqual([
      'a.txt',
      'b.txt',
    ]);
    expect((await remote.read('main')).files.map((f) => f.path)).toEqual([
      'b.txt',
    ]);
    expect((await remote.read(first)).files[0]?.content).toBe('one');
    expect(await remote.listTags()).toEqual([{ name: 'v1', commit }]);
    expect(await remote.listBranches()).toEqual(['main']);
    expect(remote.log()).toEqual(['three', 'two', 'Initial commit']);
    await expect(remote.head('nope')).rejects.toThrow(/no branch/);
  });
});

describe('commit and pull through a remote', () => {
  it('lists pending changes in plain English and commits them as one commit', async () => {
    const remote = seeded();
    const { tool, link } = await open(remote);
    expect(pendingChanges(link, tool)).toEqual([]);

    const edited = editTask(tool, (t) => {
      t.labels = { en: 'Work item' };
    });
    const shape = Object.values(edited.shapes)[0]!;
    shape.name = `${shape.name ?? 'Shape'} v2`;
    const changes = pendingChanges(link, edited);
    expect(changes).toHaveLength(2);
    expect(changes.find((c) => c.part === 'class')?.text).toBe(
      'Class "Task" changed (labels)',
    );
    expect(changes.find((c) => c.part === 'shape')?.change).toBe('changed');

    const links = createGitLinkStore(memoryKv());
    const done = await commitPending({
      remote,
      link,
      tool: edited,
      message: 'Rename Task',
      links,
    });
    expect(done.files).toBe(3); // the renamed shape is a new file and a deleted one
    expect(remote.log()[0]).toBe('Rename Task');
    expect(await links.get('bpmn-lite')).toEqual(done.link);
    expect(pendingChanges(done.link, edited)).toEqual([]);

    const again = await open(remote);
    expect(again.tool).toEqual(edited);
  });

  it('refuses an empty message and an empty commit', async () => {
    const remote = seeded();
    const { tool, link } = await open(remote);
    await expect(
      commitPending({ remote, link, tool, message: '  ' }),
    ).rejects.toThrow(/message/);
    await expect(
      commitPending({ remote, link, tool, message: 'x' }),
    ).rejects.toThrow(/nothing to commit/);
  });

  it('merges two writers who changed different parts', async () => {
    const remote = seeded();
    const a = await open(remote);
    const b = await open(remote);

    // A renames a class (file name changes) and adds a class; B changes an attribute of the same class and a shape.
    const aTool = editTask(a.tool, (t) => {
      t.key = 'Job';
      t.labels = { en: 'Job' };
    });
    const bTool = editTask(b.tool, (t) => {
      t.attributes[0] = { ...t.attributes[0]!, labels: { en: 'B label' } };
    });
    const shapeId = Object.keys(bTool.shapes)[0]!;
    bTool.shapes[shapeId as never] = {
      ...bTool.shapes[shapeId as never]!,
      name: 'B shape',
    };

    const aDone = await commitPending({
      remote,
      link: a.link,
      tool: aTool,
      message: 'A',
    });
    await expect(
      commitPending({ remote, link: b.link, tool: bTool, message: 'B' }),
    ).rejects.toBeInstanceOf(NonFastForwardError);

    const pulled = await pull({ remote, link: b.link, tool: bTool });
    if (pulled.status !== 'merged') throw new Error('expected a merge');
    expect(pulled.conflicts).toEqual([]);
    const mergedTask = pulled.tool.classes[taskOf(a.tool).id]!;
    expect(mergedTask.key).toBe('Job');
    expect(mergedTask.attributes[0]?.labels).toEqual({ en: 'B label' });
    expect(pulled.tool.shapes[shapeId as never]?.name).toBe('B shape');
    expect(pulled.merge.files.some((f) => f.path === 'classes/job.json')).toBe(
      true,
    );
    expect(pulled.merge.files.some((f) => f.path === 'classes/task.json')).toBe(
      false,
    );

    const bDone = await commitPending({
      remote,
      link: pulled.link,
      tool: pulled.tool,
      message: 'B after pull',
    });
    const aPulled = await pull({ remote, link: aDone.link, tool: aTool });
    if (aPulled.status !== 'merged') throw new Error('expected a merge');
    expect(aPulled.conflicts).toEqual([]);
    expect(aPulled.tool).toEqual(pulled.tool);
    expect(aPulled.link.baseCommit).toBe(bDone.commit);
    expect(
      await pull({ remote, link: aPulled.link, tool: aPulled.tool }),
    ).toEqual({ status: 'up-to-date' });
  });

  it('asks only for a field both sides changed, and applies the choice', async () => {
    const remote = seeded();
    const a = await open(remote);
    const b = await open(remote);
    const label = (tool: ToolLibrary, text: string, effort?: string) =>
      editTask(tool, (t) => {
        t.attributes[0] = { ...t.attributes[0]!, labels: { en: text } };
        if (effort) t.help = { en: effort };
      });
    const aTool = label(a.tool, 'From A', 'help from A');
    const bTool = label(b.tool, 'From B');
    await commitPending({ remote, link: a.link, tool: aTool, message: 'A' });

    const pulled = await pull({ remote, link: b.link, tool: bTool });
    if (pulled.status !== 'merged') throw new Error('expected a merge');
    expect(pulled.conflicts).toHaveLength(1);
    const [clash] = pulled.conflicts;
    expect(clash).toMatchObject({
      path: 'classes/task.json',
      part: 'class "Task"',
      ours: 'From B',
      theirs: 'From A',
    });
    expect(clash!.field).toBe(
      `attributes > ${a.tool.classes[Object.keys(a.tool.classes).find((k) => a.tool.classes[k as never]!.key === 'Task') as never]!.attributes[0]!.id} > labels > en`,
    );
    // The non-clashing change of A came through, and our side is the default.
    expect(taskOf(pulled.tool).help).toEqual({ en: 'help from A' });
    expect(taskOf(pulled.tool).attributes[0]?.labels).toEqual({ en: 'From B' });

    const theirs = finishPull(pulled, { [conflictKey(clash!)]: 'theirs' });
    expect(taskOf(theirs.tool).attributes[0]?.labels).toEqual({ en: 'From A' });
    expect(taskOf(theirs.tool).help).toEqual({ en: 'help from A' });
    const mine = finishPull(pulled, { [conflictKey(clash!)]: 'ours' });
    expect(taskOf(mine.tool).attributes[0]?.labels).toEqual({ en: 'From B' });
    expect(theirs.link.baseCommit).toBe(pulled.link.baseCommit);
  });

  it('handles a part removed on one side and edited on the other as a clash', () => {
    const base = toLayout(sampleTool('er-lite'));
    const edited = base.map((f) =>
      f.path === 'classes/entity.json'
        ? { ...f, content: f.content.replace('"Entity"', '"Thing"') }
        : f,
    );
    const removed = base.filter((f) => f.path !== 'classes/entity.json');
    const merge = mergeLayouts(base, removed, edited);
    expect(merge.conflicts).toHaveLength(1);
    expect(merge.conflicts[0]).toMatchObject({
      path: 'classes/entity.json',
      field: '',
      ours: undefined,
    });
    expect(merge.files.some((f) => f.path === 'classes/entity.json')).toBe(
      false,
    );
    const back = applyResolutions(merge, {
      [conflictKey(merge.conflicts[0]!)]: 'theirs',
    });
    expect(
      back.find((f) => f.path === 'classes/entity.json')?.content,
    ).toContain('Thing');
  });

  it('merges a script as source text and keeps both sides when they edit different scripts', () => {
    const base = toLayout(sampleWithBehaviour());
    const change =
      (path: string, add: string) => (f: { path: string; content: string }) =>
        f.path === path ? { ...f, content: f.content + add } : f;
    const ours = base.map(change('scripts/check-gateways.ts', '// ours\n'));
    const theirs = base.map(
      change('scripts/total-effort-by-lane.ts', '// theirs\n'),
    );
    const merge = mergeLayouts(base, ours, theirs);
    expect(merge.conflicts).toEqual([]);
    expect(
      merge.files.find((f) => f.path === 'scripts/check-gateways.ts')?.content,
    ).toMatch(/ours\n$/);
    expect(
      merge.files.find((f) => f.path === 'scripts/total-effort-by-lane.ts')
        ?.content,
    ).toMatch(/theirs\n$/);
    const clash = mergeLayouts(
      base,
      ours,
      base.map(change('scripts/check-gateways.ts', '// other\n')),
    );
    expect(clash.conflicts.map((c) => [c.path, c.field])).toEqual([
      ['scripts/check-gateways.json', 'source'],
    ]);
  });

  it('keeps attributes added by both sides, and removals', () => {
    const tool = sampleTool('bpmn-lite');
    const base = toLayout(tool);
    const withAttr = (id: string) =>
      toLayout(
        editTask(tool, (t) => {
          t.attributes = [
            ...t.attributes,
            { id: id as never, key: id.replace('att_', 'K'), type: 'text' },
          ];
        }),
      );
    const removeFirst = toLayout(
      editTask(tool, (t) => {
        t.attributes = t.attributes.slice(1);
      }),
    );
    const merge = mergeLayouts(base, withAttr('att_one'), withAttr('att_two'));
    const task = fromLayout(merge.files).tool!;
    expect(
      taskOf(task)
        .attributes.map((a) => a.id)
        .slice(-2),
    ).toEqual(['att_one', 'att_two']);
    const both = mergeLayouts(base, removeFirst, withAttr('att_two'));
    expect(both.conflicts).toEqual([]);
    const t2 = taskOf(fromLayout(both.files).tool!);
    expect(t2.attributes.length).toBe(taskOf(tool).attributes.length);
    expect(t2.attributes.at(-1)?.id).toBe('att_two');
  });
});

describe('a pull is applied as commands in one undo step', () => {
  it('changes three parts and one undo restores the tool library', () => {
    const tool = sampleTool('bpmn-lite');
    const merged = clone(tool);
    const task = taskOf(merged);
    task.labels = { en: 'Renamed' };
    const sh = Object.keys(merged.shapes)[0]!;
    merged.shapes[sh as never] = {
      ...merged.shapes[sh as never]!,
      name: 'New shape name',
    };
    const gone = Object.values(merged.classes).find((c) => c.key === 'Lane')!;
    // Remove a class together with what uses it, as a real merge would.
    delete merged.classes[gone.id];
    for (const m of Object.values(merged.modelTypes)) {
      m.classes = m.classes.filter((c) => c !== gone.id);
      for (const v of m.views)
        v.classes = v.classes.filter((c) => c !== gone.id);
      m.cardinalities = m.cardinalities.filter((k) => k.class !== gone.id);
      if (m.containers) {
        delete m.containers[gone.id];
        for (const [k, list] of Object.entries(m.containers))
          m.containers[k as never] = list.filter((c) => c !== gone.id);
      }
    }
    for (const r of Object.values(merged.relations)) {
      r.from = r.from.filter((c) => c !== gone.id);
      r.to = r.to.filter((c) => c !== gone.id);
    }
    delete merged.panels[gone.id];

    const store = createToolStore(tool);
    const batch = pullBatch(tool, merged)!;
    expect(batch.commands.length).toBeGreaterThanOrEqual(3);
    expect(store.execute(batch).ok).toBe(true);
    expect(store.state).toEqual(merged);
    expect(store.undo()).toBe(true);
    expect(store.state).toEqual(tool);
    expect(store.undo()).toBe(false);
    expect(store.redo()).toBe(true);
    expect(store.state).toEqual(merged);
  });

  it('gives no commands when nothing differs, and adds before it removes', () => {
    const tool = sampleTool('er-lite');
    expect(diffToolCommands(tool, clone(tool))).toEqual([]);
    expect(pullBatch(tool, clone(tool))).toBeNull();
    const merged = clone(tool);
    const first = Object.values(merged.classes)[0]!;
    merged.classes['cls_new' as never] = {
      ...clone(first),
      id: 'cls_new',
      key: 'Fresh',
    };
    const types = diffToolCommands(tool, merged).map((c) => c.type);
    expect(types).toEqual(['putClass']);
  });

  it('applies a whole pulled tool through the store, whatever the differences', async () => {
    const remote = seeded();
    const a = await open(remote);
    const edited = clone(a.tool);
    delete edited.rules['rule_total_effort' as never];
    delete edited.scripts['scr_gateway_check' as never];
    edited.manifest.version = '2.0.0';
    edited.settings.grid.size = 40;
    const store = createToolStore(a.tool);
    expect(store.execute(pullBatch(a.tool, edited)!).ok).toBe(true);
    expect(store.state).toEqual(edited);
  });
});

describe('releases', () => {
  it('lists tags and opens one as the tool library it was', async () => {
    const remote = seeded();
    const first = await open(remote);
    remote.tag('v1.0.0');
    const edited = editTask(first.tool, (t) => {
      t.labels = { en: 'Later' };
    });
    await commitPending({
      remote,
      link: first.link,
      tool: edited,
      message: 'later',
    });
    remote.tag('v1.1.0');
    expect((await listReleases(remote)).map((t) => t.name)).toEqual([
      'v1.1.0',
      'v1.0.0',
    ]);
    const old = await openRelease(remote, 'v1.0.0');
    expect(old.tool).toEqual(first.tool);
    expect(old.issues).toEqual([]);
    expect((await openRelease(remote, 'v1.1.0')).tool).toEqual(edited);
    await expect(
      openRelease(
        new MemoryRemote([{ path: 'README.md', content: 'x' }]),
        'main',
      ),
    ).rejects.toThrow(/cannot be read/);
  });
});

describe('link store', () => {
  it('keeps links by tool and drops damaged records', async () => {
    const kv = memoryKv();
    const store = createGitLinkStore(kv);
    const remote = seeded();
    const link = linkFromSnapshot(where, await remote.read('main'));
    await store.put(link);
    await store.put({ ...link, toolSlug: 'other' });
    expect((await store.list()).map((l) => l.toolSlug).sort()).toEqual([
      'bpmn-lite',
      'other',
    ]);
    await store.remove('other');
    expect(await store.get('other')).toBeUndefined();
    expect((await store.get('bpmn-lite'))?.baseCommit).toBe(link.baseCommit);
    await kv.set('gitLinks', { x: { toolSlug: 'x' } });
    expect(await store.list()).toEqual([]);
    expect(JSON.stringify(link)).not.toMatch(/token/i);
  });
});

describe('merge properties', () => {
  const tool = sampleWithBehaviour();
  const baseFiles = toLayout(tool);
  const edits = fc.array(
    fc.oneof(
      fc.record({
        kind: fc.constant('label' as const),
        text: fc.string({ maxLength: 8 }),
      }),
      fc.record({
        kind: fc.constant('help' as const),
        text: fc.string({ maxLength: 8 }),
      }),
      fc.record({
        kind: fc.constant('shape' as const),
        text: fc.string({ minLength: 1, maxLength: 8 }),
      }),
      fc.record({
        kind: fc.constant('attr' as const),
        n: fc.integer({ min: 0, max: 3 }),
      }),
      fc.record({ kind: fc.constant('drop' as const) }),
      fc.record({
        kind: fc.constant('script' as const),
        text: fc.string({ maxLength: 12 }),
      }),
      fc.record({
        kind: fc.constant('version' as const),
        n: fc.integer({ min: 0, max: 9 }),
      }),
    ),
    { maxLength: 4 },
  );
  type Unwrap<A> = A extends fc.Arbitrary<infer T> ? T : never;
  const apply = (list: Unwrap<typeof edits>) => {
    const next = clone(tool);
    for (const e of list) {
      const task = taskOf(next);
      if (e.kind === 'label') task.labels = { en: e.text };
      else if (e.kind === 'help') task.help = { en: e.text };
      else if (e.kind === 'shape') {
        const id = Object.keys(next.shapes)[0]! as never;
        next.shapes[id] = { ...next.shapes[id]!, name: e.text };
      } else if (e.kind === 'attr')
        task.attributes = [
          ...task.attributes,
          { id: `att_p${e.n}` as never, key: `P${e.n}`, type: 'text' as const },
        ].filter((a, i, all) => all.findIndex((x) => x.id === a.id) === i);
      else if (e.kind === 'drop') task.attributes = task.attributes.slice(1);
      else if (e.kind === 'script')
        next.scripts['scr_gateway_check' as never]!.source = e.text;
      else next.manifest.version = `1.0.${e.n}`;
    }
    return toLayout(next);
  };

  it('merge(base, x, x) = x', () => {
    fc.assert(
      fc.property(edits, (list) => {
        const x = apply(list);
        const merge = mergeLayouts(baseFiles, x, x);
        expect(merge.conflicts).toEqual([]);
        expect(merge.files).toEqual(x);
      }),
      { numRuns: 60 },
    );
  });

  it('merge(base, base, x) = x and merge(base, x, base) = x', () => {
    fc.assert(
      fc.property(edits, (list) => {
        const x = apply(list);
        for (const merge of [
          mergeLayouts(baseFiles, baseFiles, x),
          mergeLayouts(baseFiles, x, baseFiles),
        ]) {
          expect(merge.conflicts).toEqual([]);
          expect(merge.files).toEqual(x);
        }
      }),
      { numRuns: 60 },
    );
  });

  it('is symmetric when the sides touch different things', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 6 }),
        fc.integer({ min: 0, max: 9 }),
        (text, n) => {
          const a = toLayout(
            editTask(tool, (t) => void (t.help = { en: text || 'x' })),
          );
          const b = toLayout({
            ...clone(tool),
            manifest: { ...tool.manifest, version: `2.0.${n}` },
          });
          const one = mergeLayouts(baseFiles, a, b);
          const two = mergeLayouts(baseFiles, b, a);
          expect(one.conflicts).toEqual([]);
          expect(one.files).toEqual(two.files);
        },
      ),
      { numRuns: 40 },
    );
  });
});

function memoryKv() {
  const map = new Map<string, unknown>();
  return {
    get: <T>(k: string) => Promise.resolve(map.get(k) as T | undefined),
    set: (k: string, v: unknown) => {
      map.set(k, structuredClone(v));
      return Promise.resolve();
    },
  };
}
