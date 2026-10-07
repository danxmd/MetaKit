import { readFileSync } from 'node:fs';
import { MkModelError } from '@metakit-app/storage/node-entry';
import { parseArgs, UsageError } from './args';
import { exportCommand, validateCommand, type Io } from './commands';
import { CliError } from './load';

// Read at run time so the same code works from src/ (tests) and from the bundled dist/.
const packageJsonUrl = new URL('../package.json', import.meta.url);

export function getVersion(): string {
  const manifest = JSON.parse(readFileSync(packageJsonUrl, 'utf8')) as {
    version: string;
  };
  return manifest.version;
}

export const USAGE = `Usage: metakit <command> [options]

Commands:
  validate <path>            Check a workspace folder, a tool library (folder or file) or a model file.
      --strict               Treat warnings as failures.
      --json                 Print the result as JSON.
      --tool <path>          The tool library for a model file (default: tool.json next to it).
  export <model>             Write a model as an editable model file.
      --format json          The only format so far.
      --out <file>           Write to a file instead of the standard output.
      --tool <path>          The tool library for a model file.
      --workspace <folder>   Treat <model> as the folder name of a model in this workspace.

  --version                  Print the version.

Exit codes: 0 when nothing is wrong, 1 when there are errors (or warnings with --strict) or the command was used wrongly.`;

/** Runs the CLI and returns the exit code. Output goes through `io` so that tests can capture it. */
export async function run(args: string[], io: Io): Promise<number> {
  if (args.length === 0 || (args.length === 1 && args[0] === '--version')) {
    io.out(getVersion());
    return 0;
  }
  const [command, ...rest] = args;
  if (command === '--help' || command === 'help') {
    io.out(USAGE);
    return 0;
  }
  try {
    const parsed = parseArgs(rest);
    if (parsed.flags.has('help')) {
      io.out(USAGE);
      return 0;
    }
    if (command === 'validate') return await validateCommand(parsed, io);
    if (command === 'export') return await exportCommand(parsed, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`${error.message}\n\n${USAGE}`);
      return 1;
    }
    if (
      error instanceof CliError ||
      error instanceof MkModelError ||
      error instanceof Error
    ) {
      io.err(error.message);
      return 1;
    }
    throw error;
  }
  io.err(`Unknown command "${command}".\n\n${USAGE}`);
  return 1;
}
