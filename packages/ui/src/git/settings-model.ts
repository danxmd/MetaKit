import {
  DEFAULT_HOSTS,
  Redactor,
  type GitRemote,
  type GitService,
  type TokenInfo,
} from '@metakit-app/storage';

/**
 * The parts of the Git settings page that are plain data, so they can be tested without a
 * browser: the form, the checks, and how a failure reads. The page never holds a token longer than
 * one request, and never puts one in a message.
 */

/** What the page needs from the token store; `TokenStore` of the storage package fits. */
export interface TokenApi {
  list(): Promise<TokenInfo[]>;
  add(input: {
    service: GitService;
    host?: string;
    label: string;
    token: string;
  }): Promise<TokenInfo>;
  remove(id: string): Promise<void>;
  rename(id: string, label: string): Promise<void>;
  /** The secret, for the request being made now. */
  reveal(id: string): Promise<string | undefined>;
}

/** Builds the adapter for a service; the wiring decides which class and which `fetch`. */
export type MakeRemote = (
  service: GitService,
  host: string,
  repo: string,
  folder: string,
  token: string,
) => GitRemote;

/** A repository, folder and branch the person chose. Contains no secret. */
export interface GitTarget {
  tokenId: string;
  service: GitService;
  host: string;
  repo: string;
  folder: string;
  branch: string;
}

export const TOKEN_NOTICE =
  'Tokens stay in this browser only. They are never written to your workspace folder or to the repository, and they are not sent anywhere except to GitHub or GitLab.';

export const SERVICE_NAMES: Record<GitService, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
};

export interface TokenDraft {
  service: GitService;
  host: string;
  label: string;
  token: string;
}

export function newDraft(service: GitService = 'github'): TokenDraft {
  return { service, host: DEFAULT_HOSTS[service], label: '', token: '' };
}

/** Switching service swaps the default address, but keeps a host the person typed themselves. */
export function switchService(
  draft: TokenDraft,
  service: GitService,
): TokenDraft {
  const wasDefault = draft.host === DEFAULT_HOSTS[draft.service];
  return {
    ...draft,
    service,
    host: wasDefault ? DEFAULT_HOSTS[service] : draft.host,
  };
}

/** A problem with the form in plain English, or null when it can be saved. */
export function draftProblem(draft: TokenDraft): string | null {
  if (draft.token.trim() === '') return 'Paste the token first.';
  if (draft.host.trim() === '') return 'Enter the address of the service.';
  if (/\s/.test(draft.host.trim()))
    return 'The address of the service cannot contain spaces.';
  return null;
}

/**
 * `owner/name` from what a person pastes: a plain name, or the address of the repository page or
 * its `.git` clone address.
 */
export function normaliseRepo(input: string): string {
  let text = input.trim();
  text = text.replace(/^https?:\/\/[^/]+\//i, '');
  text = text.replace(/^git@[^:]+:/i, '');
  text = text.replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  // GitLab pages continue with `/-/tree/...`; GitHub pages with `/tree/<branch>`.
  text = text.replace(/\/-\/.*$/, '').replace(/\/(tree|blob)\/.*$/, '');
  return text;
}

export function repoProblem(service: GitService, repo: string): string | null {
  if (repo === '') return 'Enter the repository.';
  const parts = repo.split('/');
  if (parts.some((p) => p === '')) return 'The repository name is not valid.';
  if (service === 'github' && parts.length !== 2)
    return 'A GitHub repository is written as owner/name.';
  if (service === 'gitlab' && parts.length < 2)
    return 'A GitLab project is written with its full path, such as group/project.';
  return null;
}

/** The folder without leading or trailing slashes; '' means the root of the repository. */
export function normaliseFolder(input: string): string {
  return input.trim().replace(/^\/+|\/+$/g, '');
}

export function describeToken(info: TokenInfo): string {
  return `${SERVICE_NAMES[info.service]} · ${info.host}`;
}

export interface AccessReport {
  ok: boolean;
  /** What the person reads: the repository and permission, or why it failed. */
  text: string;
  branches: string[];
  /** The branch to select first: the one asked for if it exists, else the default. */
  branch: string;
  /** Files found in the folder at that branch, when it could be read. */
  fileCount?: number;
}

export interface AccessRequest {
  tokenId: string;
  service: GitService;
  host: string;
  repo: string;
  folder: string;
  /** The branch to look at; the default branch when empty or unknown. */
  branch?: string;
}

/**
 * Tries the token on the repository: describes the access, lists the branches and counts the
 * files in the folder. Never throws: a failure is the report's text. The token is fetched, used
 * and dropped inside this call, and the text is cleaned of it before it is returned.
 */
export async function checkAccess(
  deps: { store: Pick<TokenApi, 'reveal'>; makeRemote: MakeRemote },
  request: AccessRequest,
): Promise<AccessReport> {
  const failed = (text: string): AccessReport => ({
    ok: false,
    text,
    branches: [],
    branch: '',
  });
  const problem = repoProblem(request.service, request.repo);
  if (problem) return failed(problem);
  const redactor = new Redactor();
  try {
    const token = await deps.store.reveal(request.tokenId);
    if (!token) return failed('That token is no longer saved. Add it again.');
    redactor.add(token);
    const remote = deps.makeRemote(
      request.service,
      request.host,
      request.repo,
      request.folder,
      token,
    );
    const description = await remote.test();
    const branches = await remote.listBranches();
    const branch =
      request.branch && branches.includes(request.branch)
        ? request.branch
        : (branches[0] ?? '');
    if (branch === '')
      return {
        ok: true,
        text: `${description}. The repository has no branches yet.`,
        branches,
        branch,
      };
    const snapshot = await remote.read(branch);
    return {
      ok: true,
      text: `${description}. Branch ${branch} has ${plural(snapshot.files.length, 'file')} in ${request.folder === '' ? 'the repository root' : request.folder}.`,
      branches,
      branch,
      fileCount: snapshot.files.length,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message !== ''
        ? error.message
        : 'Something went wrong while contacting the service.';
    return failed(redactor.clean(message));
  }
}

const plural = (n: number, word: string): string =>
  `${n} ${word}${n === 1 ? '' : 's'}`;

/** The target to hand to the caller, or null when the form is not complete. */
export function toTarget(
  info: TokenInfo | undefined,
  repo: string,
  folder: string,
  branch: string,
): GitTarget | null {
  if (!info || repoProblem(info.service, repo) !== null || branch === '')
    return null;
  return {
    tokenId: info.id,
    service: info.service,
    host: info.host,
    repo,
    folder,
    branch,
  };
}
