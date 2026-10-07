import { readFileSync } from 'node:fs';

// Read at run time so the same code works from src/ (tests) and dist/ (built).
const packageJsonUrl = new URL('../package.json', import.meta.url);

export function getVersion(): string {
  const manifest = JSON.parse(readFileSync(packageJsonUrl, 'utf8')) as {
    version: string;
  };
  return manifest.version;
}

/** Runs the CLI and returns the exit code. Output goes through the given writers so tests can capture it. */
export function run(
  args: string[],
  out: (line: string) => void,
  err: (line: string) => void,
): number {
  if (args.length === 0 || (args.length === 1 && args[0] === '--version')) {
    out(getVersion());
    return 0;
  }
  err('Usage: metakit [--version]');
  return 1;
}
