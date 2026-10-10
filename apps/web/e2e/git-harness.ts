// Bundled and run inside Chromium by git-mode.spec.ts. It puts an in-memory repository in place of
// GitHub and GitLab, and lets the test act as a second person who commits to it.
import {
  MemoryRemote,
  toLayout,
  type GitFile,
  type GitRemote,
} from '@metakit-app/storage';
import type { Kit } from '@metakit-app/core';
import kit from '../../../kits/bpmn-lite/kit.json';

// A test can ask for a repository written before the Kit rename, with tool.json for kit.json.
const older = sessionStorage.getItem('e2e-git-layout') === 'before-kit-rename';
const remote = new MemoryRemote(
  toLayout(kit as unknown as Kit).map((f) =>
    older && f.path === 'kit.json' ? { ...f, path: 'tool.json' } : f,
  ),
);

async function otherWriterEdits(
  path: string,
  change: (json: Record<string, unknown>) => void,
  message: string,
): Promise<void> {
  const head = await remote.head('main');
  const snapshot = await remote.read(head);
  const file = snapshot.files.find((f) => f.path === path);
  if (!file) throw new Error(`No file ${path} in the repository`);
  const json = JSON.parse(file.content) as Record<string, unknown>;
  change(json);
  const changed: GitFile = {
    ...file,
    content: `${JSON.stringify(json, null, 2)}\n`,
  };
  await remote.commit({
    branch: 'main',
    parent: head,
    message,
    changes: [{ path: changed.path, content: changed.content }],
  });
}

const api = {
  remote,
  paths: async () => (await remote.read('main')).files.map((f) => f.path),
  file: async (path: string) =>
    (await remote.read('main')).files.find((f) => f.path === path)?.content,
  otherWriterEdits,
  commits: () => remote.log('main').length,
};

(window as unknown as { __git: typeof api }).__git = api;
(
  window as unknown as { __METAKIT_TEST__: { gitRemote: () => GitRemote } }
).__METAKIT_TEST__.gitRemote = () => remote;
