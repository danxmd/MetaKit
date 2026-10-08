import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { docsFromFiles, loadDocs } from './content';

/**
 * Turn this on once every page has its topic: then a known context without a topic fails the
 * run. Until then the missing contexts are only printed.
 */
const strictContexts = true;

const contentDir = fileURLToPath(new URL('../content', import.meta.url));

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

describe('the shipped documentation', () => {
  const files = Object.fromEntries(
    markdownFiles(contentDir).map((path) => [
      `content/${relative(contentDir, path).split('\\').join('/')}`,
      readFileSync(path, 'utf8'),
    ]),
  );
  const index = docsFromFiles(files);

  it('has no broken links, duplicate ids or other problems', () => {
    const problems = index.problems({ strictContexts });
    expect(problems.map((p) => p.message)).toEqual([]);
  });

  it('has the Tutorials index topic', () => {
    expect(index.get('tutorials-index')?.category).toBe('tutorials');
  });

  it('loads through the bundler glob the app uses', async () => {
    const loaded = await loadDocs();
    expect(loaded.topics.map((t) => t.id).sort()).toEqual(
      index.topics.map((t) => t.id).sort(),
    );
    expect(await loadDocs()).toBe(loaded);
  });

  it('reports contexts without a topic', () => {
    const missing = index.missingContexts();
    if (missing.length > 0) {
      console.info(
        `Contexts without a topic (${missing.length}): ${missing.join(', ')}`,
      );
    }
    if (strictContexts) expect(missing).toEqual([]);
  });
});
