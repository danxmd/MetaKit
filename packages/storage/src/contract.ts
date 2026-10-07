import { fromBytes, toBytes, type StorageAdapter } from './adapter';
import {
  AlreadyExistsError,
  InvalidPathError,
  NotFoundError,
  NotOwnedError,
} from './errors';

/** Two instances looking at the same storage, plus a way to clean up. */
export interface SharedStorage {
  one: StorageAdapter;
  two: StorageAdapter;
  close(): Promise<void>;
}

export interface ContractCase {
  name: string;
  run(shared: SharedStorage): Promise<void>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Contract failed: ${message}`);
}

async function rejects(
  promise: Promise<unknown>,
  type: new (...a: never[]) => Error,
  what: string,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    assert(
      error instanceof type,
      `${what}: expected ${type.name} but got ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
    );
    return;
  }
  throw new Error(
    `Contract failed: ${what}: expected ${type.name} but nothing was thrown`,
  );
}

async function eventually(
  check: () => boolean,
  what: string,
  timeoutMs = 4000,
): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`Contract failed: timed out waiting for ${what}`);
}

const text = (s: string) => toBytes(s);

/**
 * The behaviour every adapter must have. Written as plain functions that throw, so the same
 * cases run under Vitest in Node and, bundled, inside a real browser.
 */
export function adapterContract(): ContractCase[] {
  return [
    {
      name: 'lists a folder that does not exist as empty',
      async run({ one }) {
        assert(
          (await one.list('nothing/here')).length === 0,
          'missing folder lists empty',
        );
        assert((await one.list('')).length === 0, 'empty root lists empty');
      },
    },
    {
      name: 'writes a new file with its folders and reads it back',
      async run({ one }) {
        await one.writeNew('docs/a/note.json', text('{"a":1}\n'));
        assert(
          fromBytes(await one.read('docs/a/note.json')) === '{"a":1}\n',
          'content matches',
        );
        assert(await one.exists('docs/a/note.json'), 'exists');
        assert(
          !(await one.exists('docs/a/other.json')),
          'other does not exist',
        );
        const entries = await one.list('docs/a');
        assert(
          entries.length === 1 &&
            entries[0]!.name === 'note.json' &&
            entries[0]!.kind === 'file' &&
            entries[0]!.size === 8,
          'listed with size',
        );
        const top = await one.list('docs');
        assert(
          top.length === 1 &&
            top[0]!.name === 'a' &&
            top[0]!.kind === 'directory',
          'folder listed',
        );
      },
    },
    {
      name: 'refuses to write a new file over an existing one',
      async run({ one, two }) {
        await one.writeNew('shared/file.json', text('first\n'));
        await rejects(
          one.writeNew('shared/file.json', text('second\n')),
          AlreadyExistsError,
          'same instance',
        );
        await rejects(
          two.writeNew('shared/file.json', text('third\n')),
          AlreadyExistsError,
          'other instance',
        );
        assert(
          fromBytes(await two.read('shared/file.json')) === 'first\n',
          'content unchanged',
        );
      },
    },
    {
      name: 'reports a missing file',
      async run({ one }) {
        await rejects(one.read('nope/missing.json'), NotFoundError, 'read');
      },
    },
    {
      name: 'overwrites its own files, and others see whole content',
      async run({ one, two }) {
        const path = `tools/t/_state/${one.instanceId}/snapshot.json`;
        await one.overwrite(path, text('v1\n'));
        assert(
          fromBytes(await two.read(path)) === 'v1\n',
          'first version visible to the other instance',
        );
        await one.overwrite(path, text('version two\n'));
        assert(
          fromBytes(await two.read(path)) === 'version two\n',
          'second version visible',
        );
        await one.overwrite(path, text('3\n'));
        assert(
          fromBytes(await two.read(path)) === '3\n',
          'shorter content replaces longer',
        );
      },
    },
    {
      name: 'refuses to overwrite or remove anything that is not its own',
      async run({ one, two }) {
        await one.writeNew('shared/file.json', text('x\n'));
        await rejects(
          one.overwrite('shared/file.json', text('y\n')),
          NotOwnedError,
          'overwrite shared',
        );
        await rejects(
          one.remove('shared/file.json'),
          NotOwnedError,
          'remove shared',
        );
        const theirs = `tools/t/_state/${two.instanceId}/snapshot.json`;
        await two.overwrite(theirs, text('theirs\n'));
        await rejects(
          one.overwrite(theirs, text('mine\n')),
          NotOwnedError,
          'overwrite theirs',
        );
        await rejects(one.remove(theirs), NotOwnedError, 'remove theirs');
        assert(
          fromBytes(await one.read(theirs)) === 'theirs\n',
          'their file is intact',
        );
        assert(
          fromBytes(await one.read('shared/file.json')) === 'x\n',
          'shared file is intact',
        );
      },
    },
    {
      name: "refuses to write into another instance's area",
      async run({ one, two }) {
        await rejects(
          one.writeNew(
            `tools/t/_state/${two.instanceId}/000001.jsonl`,
            text('x\n'),
          ),
          NotOwnedError,
          'change file',
        );
        await rejects(
          one.writeNew(`_presence/${two.instanceId}.json`, text('x\n')),
          NotOwnedError,
          'presence',
        );
        await one.writeNew(
          `tools/t/_state/${one.instanceId}/000001.jsonl`,
          text('x\n'),
        );
        await one.writeNew(`_presence/${one.instanceId}.json`, text('x\n'));
      },
    },
    {
      name: 'removes its own files and does not mind a second removal',
      async run({ one }) {
        const path = `m/_state/${one.instanceId}/000001.jsonl`;
        await one.writeNew(path, text('x\n'));
        await one.remove(path);
        assert(!(await one.exists(path)), 'gone');
        await one.remove(path);
      },
    },
    {
      name: 'refuses paths that could leave the workspace or upset a sync tool',
      async run({ one }) {
        const bad = [
          '../x',
          'a/../x',
          '/abs',
          'a//b',
          'a/./b',
          '.hidden/x',
          'a/.hidden',
          'a\\b',
          'a:b',
          'what?',
          'tail.',
          'tail /x',
          'a\u0000b',
        ];
        for (const path of bad) {
          await rejects(
            one.writeNew(path, text('x\n')),
            InvalidPathError,
            `writeNew ${JSON.stringify(path)}`,
          );
          await rejects(
            one.read(path),
            InvalidPathError,
            `read ${JSON.stringify(path)}`,
          );
          await rejects(
            one.list(path),
            InvalidPathError,
            `list ${JSON.stringify(path)}`,
          );
        }
      },
    },
    {
      name: 'lists files and folders in a stable order',
      async run({ one }) {
        await one.writeNew('d/b.json', text('b\n'));
        await one.writeNew('d/a.json', text('a\n'));
        await one.writeNew('d/sub/c.json', text('c\n'));
        const entries = await one.list('d');
        assert(
          entries.map((e) => `${e.kind}:${e.name}`).join(',') ===
            'file:a.json,file:b.json,directory:sub',
          `order was ${entries.map((e) => e.name).join(',')}`,
        );
      },
    },
    {
      name: 'keeps every byte value and large files intact',
      async run({ one, two }) {
        const all = new Uint8Array(256).map((_, i) => i);
        await one.writeNew('bin/all.bin', all);
        const back = await two.read('bin/all.bin');
        assert(
          back.length === 256 && back.every((b, i) => b === i),
          'all 256 byte values survive',
        );
        const big = new Uint8Array(1_000_000).map((_, i) => (i * 31) & 255);
        await one.writeNew('bin/big.bin', big);
        const bigBack = await two.read('bin/big.bin');
        assert(
          bigBack.length === big.length &&
            bigBack[999_999] === big[999_999] &&
            bigBack[12345] === big[12345],
          'a megabyte survives',
        );
      },
    },
    {
      name: 'handles names with accents and other scripts',
      async run({ one }) {
        await one.writeNew('modelle/Übersicht-日本語.json', text('{}\n'));
        assert(
          (await one.list('modelle'))[0]!.name === 'Übersicht-日本語.json',
          'name preserved',
        );
        assert(
          fromBytes(await one.read('modelle/Übersicht-日本語.json')) === '{}\n',
          'content',
        );
      },
    },
    {
      name: 'reports files that appear, change and disappear',
      async run({ one, two }) {
        const seen: string[][] = [];
        await one.writeNew('w/existing.json', text('1\n'));
        const stop = two.watch('w', (changed) => void seen.push(changed));
        await new Promise((r) => setTimeout(r, 150));
        await one.writeNew('w/new.json', text('n\n'));
        await eventually(
          () => seen.flat().includes('w/new.json'),
          'a new file to be reported',
        );
        const own = `w/_state/${one.instanceId}/snapshot.json`;
        await one.overwrite(own, text('a\n'));
        await eventually(
          () => seen.flat().includes(own),
          'another new file to be reported',
        );
        const before = seen.length;
        await one.overwrite(own, text('a longer content\n'));
        await eventually(
          () => seen.length > before && seen.slice(before).flat().includes(own),
          'a change to be reported',
        );
        await one.remove(own);
        await eventually(
          () => seen.flat().filter((p) => p === own).length >= 3,
          'a removal to be reported',
        );
        stop();
        const after = seen.length;
        await one.writeNew('w/after-stop.json', text('x\n'));
        await new Promise((r) => setTimeout(r, 250));
        assert(seen.length === after, 'nothing is reported after stopping');
        assert(
          !seen.flat().includes('w/existing.json'),
          'files that were already there are not reported',
        );
      },
    },
  ];
}
