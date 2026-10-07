/**
 * What Git mode needs from a hosting service (ADR 0007). GitHub and GitLab each implement it with
 * their REST API; the layout, the merge and the user interface depend only on this interface, so
 * they are tested against an in-memory remote.
 */

/** A file of the repository as text. Binary assets are carried as base64 with `encoding: 'base64'`. */
export interface GitFile {
  /** Path from the root of the folder that holds the tool library, with `/` separators. */
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64';
}

export interface GitSnapshot {
  /** The commit this snapshot is the tree of. */
  commit: string;
  /** Every file under the tool library's folder. */
  files: GitFile[];
}

export interface GitChange {
  path: string;
  /** New content, or null to delete the file. */
  content: string | null;
  encoding?: 'utf8' | 'base64';
}

export interface GitCommitRequest {
  branch: string;
  /** The commit the changes were made on. The remote refuses the commit if the branch has moved. */
  parent: string;
  message: string;
  changes: GitChange[];
}

export interface GitTag {
  name: string;
  commit: string;
}

export interface GitRemote {
  /** Names of the branches, the default branch first. */
  listBranches(): Promise<string[]>;
  /** Tags, newest first when the service says so. */
  listTags(): Promise<GitTag[]>;
  /** The newest commit of a branch. */
  head(branch: string): Promise<string>;
  /** The files at a branch name, a tag name or a commit id. */
  read(ref: string): Promise<GitSnapshot>;
  /**
   * One commit for all changes. Throws `NonFastForwardError` when the branch has moved on from
   * `parent`, and nothing is changed in that case.
   */
  commit(request: GitCommitRequest): Promise<{ commit: string }>;
  /** Checks the access: resolves with a short description such as the repository name. Throws a plain-English error. */
  test(): Promise<string>;
}

export class NonFastForwardError extends Error {
  constructor(message = 'The branch has changed since you last pulled. Pull first, then commit again.') {
    super(message);
    this.name = 'NonFastForwardError';
  }
}

/** A service answered "no": a missing or wrong token, a missing repository, a missing permission. */
export class GitAccessError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GitAccessError';
  }
}
