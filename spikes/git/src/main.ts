import { probe } from './cors';
import { githubCheck, gitlabCheck } from './flows';
import { GitHubClient } from './github';
import { GitLabClient } from './gitlab';
import {
  buildAuthorizeUrl,
  challengeFor,
  createVerifier,
  exchangeCode,
} from './pkce';
import { Redactor } from './redact';

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const redactor = new Redactor();

const DEFAULT_BASE = {
  github: 'https://api.github.com',
  gitlab: 'https://gitlab.com',
} as const;
type Provider = keyof typeof DEFAULT_BASE;

// Everything shown goes through the redactor, tokens included.
function log(line: string): void {
  const out = $('log');
  out.textContent = `${out.textContent === 'Ready.' ? '' : `${out.textContent}\n`}${redactor.clean(line)}`;
}

const provider = () => $<HTMLSelectElement>('provider').value as Provider;
const field = (id: string) => $<HTMLInputElement>(id).value.trim();

function setDefaults() {
  const p = provider();
  $<HTMLInputElement>('base').value =
    params.get(p === 'github' ? 'ghBase' : 'glBase') ?? DEFAULT_BASE[p];
  $('client').parentElement!.style.display = p === 'gitlab' ? '' : 'none';
  $('signin').style.display = p === 'gitlab' ? '' : 'none';
}
$('provider').addEventListener('change', setDefaults);
if (params.get('provider'))
  $<HTMLSelectElement>('provider').value = params.get('provider')!;
setDefaults();

$('token').addEventListener('input', () => redactor.add(field('token')));

function repoParts(): { owner: string; name: string } {
  const [owner, ...rest] = field('repo').split('/');
  return { owner: owner ?? '', name: rest.join('/') };
}

async function run(label: string, work: () => Promise<void>) {
  log(`\n== ${label}`);
  try {
    await work();
  } catch (error) {
    log(`stopped: ${error instanceof Error ? error.message : String(error)}`);
  }
}

$('cors').addEventListener('click', () =>
  run('browser access check', async () => {
    const base = field('base').replace(/\/$/, '');
    const { owner, name } = repoParts();
    const auth = { Authorization: `Bearer ${field('token')}` };
    const target =
      provider() === 'github'
        ? `${base}/repos/${owner}/${name}`
        : `${base}/api/v4/projects/${encodeURIComponent(field('repo'))}`;
    const api = await probe(target, {
      headers: {
        ...auth,
        ...(provider() === 'github'
          ? { Accept: 'application/vnd.github+json' }
          : {}),
      },
    });
    log(
      api.ok
        ? `The browser could call ${target} (status ${api.status}). Headers readable by the page: ${api.visibleHeaders!.join(', ') || 'none'}`
        : `The browser could NOT call ${target}: ${api.error}. This is CORS or the address is unreachable.`,
    );
    if (provider() === 'gitlab') {
      const token = await probe(`${base}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=authorization_code&client_id=probe&code=probe&redirect_uri=http%3A%2F%2Flocalhost&code_verifier=probe',
      });
      log(
        token.ok
          ? `The browser could call the OAuth token endpoint (status ${token.status}, an error here is expected).`
          : `The browser could NOT call the OAuth token endpoint: ${token.error}`,
      );
    }
  }),
);

function clients() {
  const base = field('base').replace(/\/$/, '');
  redactor.add(field('token'));
  return provider() === 'github'
    ? { github: new GitHubClient({ token: field('token'), baseUrl: base }) }
    : { gitlab: new GitLabClient({ token: field('token'), baseUrl: base }) };
}

$('tree').addEventListener('click', () =>
  run('read the tree', async () => {
    const c = clients();
    if (c.github) {
      const { owner, name } = repoParts();
      const tree = await c.github.readTree(owner, name, field('branch'));
      log(
        `${tree.entries.length} files at ${tree.commitSha.slice(0, 7)}${tree.truncated ? ' (truncated by GitHub)' : ''}`,
      );
      log(
        tree.entries
          .slice(0, 10)
          .map((e) => `  ${e.path}`)
          .join('\n'),
      );
    } else {
      const tree = await c.gitlab!.readTree(field('repo'), field('branch'), {
        maxPages: 5,
      });
      log(
        `${tree.files.length} files on ${tree.pages} page(s) (${tree.entries} entries read)${tree.complete ? '' : ', stopped after 5 pages'}`,
      );
      log(
        tree.files
          .slice(0, 10)
          .map((e) => `  ${e.path}`)
          .join('\n'),
      );
    }
  }),
);

$('check').addEventListener('click', () =>
  run('full check on a throwaway branch', async () => {
    const c = clients();
    const runId = `${Date.now().toString(36)}`;
    const keepBranch = $<HTMLInputElement>('keep').checked;
    if (c.github) {
      const { owner, name } = repoParts();
      const result = await githubCheck({
        api: c.github,
        owner,
        repo: name,
        baseBranch: field('branch'),
        runId,
        log,
        keepBranch,
      });
      log(
        `Result: ${result.steps.every((s) => s.ok) && result.rejectionLeftBranchAlone ? 'ALL STEPS PASSED' : 'SOME STEPS FAILED'}`,
      );
    } else {
      const result = await gitlabCheck({
        api: c.gitlab!,
        project: field('repo'),
        baseBranch: field('branch'),
        runId,
        log,
        keepBranch,
      });
      log(
        `Result: ${result.steps.every((s) => s.ok) && result.rejectionLeftBranchAlone ? 'ALL STEPS PASSED' : 'SOME STEPS FAILED'}`,
      );
    }
  }),
);

// --- GitLab sign-in with PKCE ----------------------------------------------------------

const redirectUri = () => `${location.origin}${location.pathname}`;

$('signin').addEventListener('click', () =>
  run('start sign-in', async () => {
    const verifier = createVerifier();
    const state = createVerifier();
    // The verifier and state only need to survive the redirect, so session storage is enough. They are
    // not secrets once the code is used, and the access token itself is never stored.
    sessionStorage.setItem(
      'pkce',
      JSON.stringify({
        verifier,
        state,
        base: field('base'),
        client: field('client'),
        repo: field('repo'),
        branch: field('branch'),
      }),
    );
    location.assign(
      buildAuthorizeUrl({
        baseUrl: field('base'),
        clientId: field('client'),
        redirectUri: redirectUri(),
        state,
        challenge: await challengeFor(verifier),
      }),
    );
  }),
);

async function finishSignIn() {
  const code = params.get('code');
  const saved = sessionStorage.getItem('pkce');
  if (!code || !saved) return;
  sessionStorage.removeItem('pkce');
  const { verifier, state, base, client, repo, branch } = JSON.parse(
    saved,
  ) as Record<string, string>;
  $<HTMLSelectElement>('provider').value = 'gitlab';
  setDefaults();
  $<HTMLInputElement>('base').value = base!;
  $<HTMLInputElement>('client').value = client!;
  $<HTMLInputElement>('repo').value = repo!;
  $<HTMLInputElement>('branch').value = branch!;
  history.replaceState(null, '', redirectUri());
  await run('finish sign-in', async () => {
    if (params.get('state') !== state)
      throw new Error(
        'The sign-in answer did not match this page (state mismatch).',
      );
    const token = await exchangeCode({
      baseUrl: base!,
      clientId: client!,
      redirectUri: redirectUri(),
      code,
      verifier: verifier!,
    });
    redactor.add(token.access_token);
    $<HTMLInputElement>('token').value = token.access_token;
    log(
      `Signed in. The access token (${token.token_type}, expires in ${token.expires_in ?? '?'} s) is held in memory only.`,
    );
  });
}
void finishSignIn();
