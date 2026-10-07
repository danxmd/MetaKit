import {
  GitAccessError,
  NonFastForwardError,
  type GitCommitRequest,
  type GitFile,
  type GitRemote,
  type GitSnapshot,
  type GitTag,
} from './remote';

interface Commit {
  id: string;
  parent: string | null;
  message: string;
  files: Map<string, GitFile>;
}

/** 40 hex digits from a text; only has to differ for different commits. */
function fakeSha(text: string): string {
  let out = '';
  for (let round = 0; out.length < 40; round++) {
    let h = 0x811c9dc5 ^ round;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
  }
  return out.slice(0, 40);
}

/**
 * A remote that lives in memory and behaves like a real one: commits have ids, branches move,
 * tags name commits, and a commit on a stale parent is refused. For tests, and for building the
 * user interface before an account is connected.
 */
export class MemoryRemote implements GitRemote {
  private readonly commits = new Map<string, Commit>();
  private readonly branches = new Map<string, string>();
  private readonly tagged = new Map<string, string>();
  private counter = 0;
  private readonly main: string;

  constructor(initial: readonly GitFile[] = [], defaultBranch = 'main') {
    this.main = defaultBranch;
    const root = this.make(
      null,
      'Initial commit',
      new Map(initial.map((f) => [f.path, { ...f }])),
    );
    this.branches.set(defaultBranch, root.id);
  }

  private make(
    parent: string | null,
    message: string,
    files: Map<string, GitFile>,
  ): Commit {
    const id = fakeSha(`${this.counter++}|${parent ?? ''}|${message}`);
    const commit = { id, parent, message, files };
    this.commits.set(id, commit);
    return commit;
  }

  /** Test helper: a new branch at the head of another. */
  createBranch(name: string, from = this.main): void {
    this.branches.set(name, this.headOf(from));
  }

  /** Test helper: a tag on a branch head, a tag or a commit. */
  tag(name: string, ref = this.main): void {
    this.tagged.set(name, this.resolve(ref));
  }

  /** The messages of the commits of a branch, newest first. */
  log(branch = this.main): string[] {
    const out: string[] = [];
    for (let at: string | null = this.headOf(branch); at;) {
      const c = this.commits.get(at);
      if (!c) break;
      out.push(c.message);
      at = c.parent;
    }
    return out;
  }

  private headOf(branch: string): string {
    const id = this.branches.get(branch);
    if (!id)
      throw new GitAccessError(`There is no branch called "${branch}".`, 404);
    return id;
  }

  private resolve(ref: string): string {
    return (
      this.branches.get(ref) ??
      this.tagged.get(ref) ??
      (this.commits.has(ref) ? ref : this.headOf(ref))
    );
  }

  listBranches(): Promise<string[]> {
    return Promise.resolve([
      this.main,
      ...[...this.branches.keys()].filter((b) => b !== this.main).sort(),
    ]);
  }

  listTags(): Promise<GitTag[]> {
    // Newest first, like the services that sort by date.
    return Promise.resolve(
      [...this.tagged].reverse().map(([name, commit]) => ({ name, commit })),
    );
  }

  head(branch: string): Promise<string> {
    return this.settle(() => this.headOf(branch));
  }

  read(ref: string): Promise<GitSnapshot> {
    return this.settle(() => {
      const id = this.resolve(ref);
      const commit = this.commits.get(id)!;
      return {
        commit: id,
        files: [...commit.files.values()]
          .map((f) => ({ ...f }))
          .sort((a, b) => (a.path < b.path ? -1 : 1)),
      };
    });
  }

  commit(request: GitCommitRequest): Promise<{ commit: string }> {
    return this.settle(() => {
      const head = this.headOf(request.branch);
      if (head !== request.parent) throw new NonFastForwardError();
      const files = new Map(this.commits.get(head)!.files);
      for (const change of request.changes) {
        if (change.content === null) files.delete(change.path);
        else
          files.set(change.path, {
            path: change.path,
            content: change.content,
            ...(change.encoding ? { encoding: change.encoding } : {}),
          });
      }
      const commit = this.make(head, request.message, files);
      this.branches.set(request.branch, commit.id);
      return { commit: commit.id };
    });
  }

  test(): Promise<string> {
    return Promise.resolve('memory repository');
  }

  // Real remotes answer asynchronously and report errors as rejections.
  private settle<T>(fn: () => T): Promise<T> {
    try {
      return Promise.resolve(fn());
    } catch (error) {
      return Promise.reject(error as Error);
    }
  }
}
