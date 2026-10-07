import { describe, expect, it } from 'vitest';
import { MemoryFolder } from './memory-adapter';
import {
  detectDivergence,
  formatPresence,
  isFresh,
  parsePresence,
  PresenceService,
  whoIsEditing,
  type PresenceFile,
} from './presence';
import type { Timers } from './session';

function clock() {
  let now = Date.parse('2026-03-01T09:00:00Z');
  const timers = new Map<number, { at: number; fn: () => void }>();
  let next = 1;
  const api: Timers = {
    setTimeout: (fn, ms) => {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
  };
  return {
    now: () => now,
    timers: api,
    async advance(ms: number) {
      now += ms;
      for (const [id, t] of [...timers])
        if (t.at <= now) {
          timers.delete(id);
          t.fn();
        }
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

const file = (over: Partial<PresenceFile> = {}): PresenceFile => ({
  formatVersion: 1,
  instance: 'aaaa0001',
  name: 'Anna',
  colour: '#e8590c',
  at: '2026-03-01T09:00:00.000Z',
  document: { kind: 'model', slug: 'm1' },
  selection: [],
  editing: null,
  hash: 'h1',
  seen: { aaaa0001: 3 },
  ...over,
});

describe('presence files', () => {
  it('round-trips, ends with a newline, and refuses incomplete and newer files', () => {
    const text = formatPresence(file({ selection: ['el_a'] }));
    expect(text.endsWith('\n')).toBe(true);
    expect(parsePresence(text)).toEqual(file({ selection: ['el_a'] }));
    expect(() => parsePresence(text.slice(0, -1))).toThrow(/not complete/);
    expect(() =>
      parsePresence(text.replace('"formatVersion": 1', '"formatVersion": 9')),
    ).toThrow(/newer/);
    expect(() => parsePresence('{"formatVersion":1}\n')).toThrow(/lacks/);
  });

  it('counts a file as fresh for 30 seconds', () => {
    const at = Date.parse('2026-03-01T09:00:00.000Z');
    expect(isFresh(file(), at + 29_000)).toBe(true);
    expect(isFresh(file(), at + 31_000)).toBe(false);
  });
});

describe('divergence and editing', () => {
  it('reports different hashes only for the same document and the same files read', () => {
    const a = file({
      instance: 'aaaa0001',
      hash: 'x',
      seen: { aaaa0001: 3, bbbb0002: 2 },
    });
    const b = file({
      instance: 'bbbb0002',
      hash: 'y',
      seen: { aaaa0001: 3, bbbb0002: 2 },
    });
    expect(detectDivergence([a, b])).toHaveLength(1);
    expect(
      detectDivergence([a, { ...b, seen: { aaaa0001: 2, bbbb0002: 2 } }]),
    ).toEqual([]);
    expect(detectDivergence([a, { ...b, hash: 'x' }])).toEqual([]);
    expect(
      detectDivergence([
        a,
        { ...b, document: { kind: 'model', slug: 'other' } },
      ]),
    ).toEqual([]);
    expect(detectDivergence([a, { ...b, hash: '' }])).toEqual([]);
  });

  it('names the others who have an item open', () => {
    const anna = file({ editing: 'script_1' });
    const me = file({ instance: 'bbbb0002', editing: 'script_1' });
    const elsewhere = file({
      instance: 'cccc0003',
      editing: 'script_1',
      document: { kind: 'model', slug: 'other' },
    });
    expect(
      whoIsEditing(
        [anna, me, elsewhere],
        { kind: 'model', slug: 'm1' },
        'script_1',
        'bbbb0002',
      ).map((p) => p.name),
    ).toEqual(['Anna']);
    expect(
      whoIsEditing(
        [anna],
        { kind: 'model', slug: 'm1' },
        'script_2',
        'bbbb0002',
      ),
    ).toEqual([]);
  });
});

describe('PresenceService', () => {
  function pair() {
    const folder = new MemoryFolder();
    const time = clock();
    const mk = (id: string, name: string) =>
      new PresenceService({
        adapter: folder.instance(id),
        profile: { name, colour: '#364fc7' },
        now: time.now,
        timers: time.timers,
      });
    return {
      folder,
      time,
      a: mk('aaaa0001', 'Anna'),
      b: mk('bbbb0002', 'Ben'),
    };
  }

  it('shows each to the other within one refresh, with their selection', async () => {
    const { a, b } = pair();
    a.start();
    b.start();
    a.setDocument({ kind: 'model', slug: 'm1' }, () => ({
      hash: 'h',
      seen: {},
    }));
    a.setSelection(['el_2', 'el_1']);
    await a.refresh();
    const seen = await b.refresh();
    expect(seen.map((p) => [p.name, p.document?.slug, p.selection])).toEqual([
      ['Anna', 'm1', ['el_1', 'el_2']],
    ]);
    expect((await a.refresh()).map((p) => p.name)).toEqual(['Ben']);
  });

  it('writes only its own file, and removes it on stop', async () => {
    const { folder, a } = pair();
    a.start();
    await a.refresh();
    await a.stop();
    const log = folder.log.filter((l) => l.by === 'aaaa0001');
    expect(log.length).toBeGreaterThan(0);
    for (const l of log) expect(l.path).toBe('_presence/aaaa0001.json');
    expect(folder.files.has('_presence/aaaa0001.json')).toBe(false);
  });

  it('forgets a person whose file stopped being refreshed', async () => {
    const { time, a, b } = pair();
    a.start();
    b.start();
    await a.refresh();
    expect((await b.refresh()).length).toBe(1);
    await time.advance(31_000); // a's timer would refresh; stop it so it goes quiet
    await a.stop();
    expect((await b.refresh()).length).toBe(0);
  });

  it('refreshes by itself every 10 seconds', async () => {
    const { folder, time, a } = pair();
    a.start();
    await a.refresh();
    const first = folder.text('_presence/aaaa0001.json');
    await time.advance(10_000);
    expect(folder.text('_presence/aaaa0001.json')).not.toBe(first);
  });

  it('writes a selection change soon, but not more than once a second', async () => {
    const { folder, time, a } = pair();
    a.start();
    await a.refresh();
    const writes = () => folder.log.filter((l) => l.op === 'overwrite').length;
    const before = writes();
    for (let i = 0; i < 10; i++) a.setSelection([`el_${i}`]);
    expect(writes()).toBe(before);
    await time.advance(1000);
    expect(writes()).toBe(before + 1);
    expect(
      parsePresence(folder.text('_presence/aaaa0001.json')).selection,
    ).toEqual(['el_9']);
  });

  it("reads a change in somebody else's file at once without writing its own", async () => {
    const { folder, time, a, b } = pair();
    a.start();
    b.start();
    await a.refresh();
    await b.refresh();
    const writesOfB = () =>
      folder.log.filter((l) => l.by === 'bbbb0002' && l.op === 'overwrite')
        .length;
    const before = writesOfB();
    a.setEditing('el_text');
    await a.refresh(); // a writes its file, which the folder reports to b's watcher
    await time.advance(300); // b's short delay before it reads
    expect(b.people.map((p) => p.editing)).toEqual(['el_text']);
    expect(writesOfB()).toBe(before);
  });
});
