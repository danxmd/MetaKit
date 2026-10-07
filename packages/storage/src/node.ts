import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type {
  DirEntry,
  StorageAdapter,
  Unwatch,
  WatchCallback,
} from './adapter';
import { AlreadyExistsError, NotFoundError } from './errors';
import {
  assertMayWrite,
  checkInstanceId,
  checkPath,
  newInstanceId,
} from './paths';
import { pollWatch } from './watch';

const PART = '.part';

const code = (error: unknown): string | undefined =>
  (error as NodeJS.ErrnoException | undefined)?.code;

/** A workspace in a folder on disk: for the CLI, for tests and for anything that runs in Node. */
export class NodeFsAdapter implements StorageAdapter {
  readonly instanceId: string;

  constructor(
    readonly root: string,
    instanceId: string = newInstanceId(),
    private readonly options: { pollIntervalMs?: number } = {},
  ) {
    this.instanceId = checkInstanceId(instanceId);
  }

  private resolve(path: string): string {
    return join(this.root, ...checkPath(path));
  }

  async list(dir: string): Promise<DirEntry[]> {
    const folder = this.resolve(dir);
    let names;
    try {
      names = await fs.readdir(folder, { withFileTypes: true });
    } catch (error) {
      if (code(error) === 'ENOENT' || code(error) === 'ENOTDIR') return [];
      throw error;
    }
    const entries: DirEntry[] = [];
    for (const entry of names) {
      if (entry.name.endsWith(PART)) continue;
      if (entry.isDirectory())
        entries.push({ name: entry.name, kind: 'directory' });
      else if (entry.isFile()) {
        try {
          const stat = await fs.stat(join(folder, entry.name));
          entries.push({
            name: entry.name,
            kind: 'file',
            size: stat.size,
            modified: Math.round(stat.mtimeMs),
          });
        } catch (error) {
          // Removed between the listing and the stat: it is gone, so it is not listed.
          if (code(error) !== 'ENOENT') throw error;
        }
      }
    }
    return entries.sort((a, b) => (a.name < b.name ? -1 : 1));
  }

  async read(path: string): Promise<Uint8Array> {
    try {
      return new Uint8Array(await fs.readFile(this.resolve(path)));
    } catch (error) {
      if (code(error) === 'ENOENT' || code(error) === 'EISDIR')
        throw new NotFoundError(`There is no file "${path}".`);
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      return (await fs.stat(this.resolve(path))).isFile();
    } catch (error) {
      if (code(error) === 'ENOENT' || code(error) === 'ENOTDIR') return false;
      throw error;
    }
  }

  async writeNew(path: string, data: Uint8Array): Promise<void> {
    assertMayWrite(path, this.instanceId, 'new');
    const target = this.resolve(path);
    await fs.mkdir(join(target, '..'), { recursive: true });
    const temp = `${target}.${randomBytes(4).toString('hex')}${PART}`;
    await fs.writeFile(temp, data);
    try {
      // A hard link appears complete and fails if the target exists, so a reader never sees half a
      // file and two writers cannot both win.
      await fs.link(temp, target);
    } catch (error) {
      if (code(error) === 'EEXIST')
        throw new AlreadyExistsError(
          `"${path}" already exists. Files that other instances may have read are written once and never replaced.`,
        );
      if (
        ![
          'EPERM',
          'ENOTSUP',
          'EOPNOTSUPP',
          'ENOSYS',
          'EXDEV',
          'EACCES',
        ].includes(code(error) ?? '')
      )
        throw error;
      // This file system has no hard links (some synced or network folders): write in place, still refusing to replace.
      try {
        await fs.writeFile(target, data, { flag: 'wx' });
      } catch (inner) {
        if (code(inner) === 'EEXIST')
          throw new AlreadyExistsError(
            `"${path}" already exists. Files that other instances may have read are written once and never replaced.`,
          );
        throw inner;
      }
    } finally {
      await fs.rm(temp, { force: true });
    }
  }

  async overwrite(path: string, data: Uint8Array): Promise<void> {
    assertMayWrite(path, this.instanceId, 'own');
    const target = this.resolve(path);
    await fs.mkdir(join(target, '..'), { recursive: true });
    const temp = `${target}.${randomBytes(4).toString('hex')}${PART}`;
    try {
      await fs.writeFile(temp, data);
      // Renaming over the old file replaces it in one step.
      await fs.rename(temp, target);
    } catch (error) {
      await fs.rm(temp, { force: true });
      throw error;
    }
  }

  async remove(path: string): Promise<void> {
    assertMayWrite(path, this.instanceId, 'own');
    await fs.rm(this.resolve(path), { force: true });
  }

  watch(dir: string, callback: WatchCallback): Unwatch {
    checkPath(dir);
    return pollWatch(this, dir, callback, {
      intervalMs: this.options.pollIntervalMs ?? 50,
    }).stop;
  }
}
