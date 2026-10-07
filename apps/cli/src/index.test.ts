import { describe, expect, it } from 'vitest';
import { getVersion, run } from './index';

function capture(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = run(
    args,
    (l) => out.push(l),
    (l) => err.push(l),
  );
  return { code, out, err };
}

describe('@metakit-app/cli', () => {
  it('reads the version from package.json', () => {
    expect(getVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prints the version for --version and for no arguments', () => {
    expect(capture(['--version'])).toEqual({
      code: 0,
      out: [getVersion()],
      err: [],
    });
    expect(capture([])).toEqual({ code: 0, out: [getVersion()], err: [] });
  });

  it('rejects unknown arguments', () => {
    const result = capture(['--nope']);
    expect(result.code).toBe(1);
    expect(result.out).toEqual([]);
  });
});
