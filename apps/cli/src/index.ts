import { readFileSync } from 'node:fs';
import { MkModelError } from '@metakit-app/storage/node-entry';
import { parseArgs, UsageError } from './args';
import { exportCommand, validateCommand, type Io } from './commands';
import {
  exportBundleCommand,
  exportCsvCommand,
  exportKitCommand,
  importBundleCommand,
  importKitCommand,
} from './exchange';
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
  validate <path>            Check a workspace folder, a Kit (folder or file) or a model file.
      --strict               Treat warnings as failures.
      --json                 Print the result as JSON.
      --kit <path>           The Kit for a model file (default: kit.json or tool.json next to it).
  export <model>             Write a model as an editable model file.
      --format json          The only format so far.
      --out <file>           Write to a file instead of the standard output.
      --kit <path>           The Kit for a model file.
      --workspace <folder>   Treat <model> as the folder name of a model in this workspace.
  export-bundle [<model>...] Pack models and their Kit into a .mkbundle (all models when none are named).
      --workspace <folder>   The workspace; <model> is the folder name of a model in it.
      --out <file>           The bundle to write.
      --name <name>          The name of the bundle.
      --no-kit               Leave the Kit out.
  import-bundle <file>       Add the models (and the Kit, when new) of a .mkbundle to a workspace.
      --workspace <folder>   The workspace to add to.
      --create               Make the folder a workspace first when it is not one yet.
  export-kit <kit>           Write a Kit as a .mkkit package.
      --workspace <folder>   Treat <kit> as the folder name of a Kit in this workspace (otherwise a path).
      --out <file>           The package to write.
  import-kit <file>          Add or update a Kit from a .mkkit (or .mktool) package; shows what changes first.
      --workspace <folder>   The workspace to add to.
      --yes                  Apply an update to a Kit that is already there.
      --create               Make the folder a workspace first when it is not one yet.
  export-csv <model>         Write a model as CSV files, one per class and per relation class.
      --workspace <folder>   Treat <model> as the folder name of a model in this workspace.
      --kit <path>           The Kit for a model file.
      --out <folder|.zip>    Write the files into a folder, or into one zip when this ends in .zip.
      --bom                  Start each file with a byte order mark so that Excel reads accents correctly.

  --version                  Print the version.

Older names (from before the tool library was called a Kit; they still work):
  export-tool, import-tool   Same as export-kit and import-kit.
  --tool, --no-tool          Same as --kit and --no-kit.

Exit codes: 0 when nothing is wrong, 1 when there are errors (or warnings with --strict) or the command was used wrongly.`;

/** The command names from before the Kit rename, which keep working. */
const COMMAND_ALIASES: Readonly<Record<string, string>> = {
  'export-tool': 'export-kit',
  'import-tool': 'import-kit',
};

/** Runs the CLI and returns the exit code. Output goes through `io` so that tests can capture it. */
export async function run(args: string[], io: Io): Promise<number> {
  if (args.length === 0 || (args.length === 1 && args[0] === '--version')) {
    io.out(getVersion());
    return 0;
  }
  const [given = '', ...rest] = args;
  const command = COMMAND_ALIASES[given] ?? given;
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
    if (command === 'export-bundle')
      return await exportBundleCommand(parsed, io);
    if (command === 'import-bundle')
      return await importBundleCommand(parsed, io);
    if (command === 'export-kit') return await exportKitCommand(parsed, io);
    if (command === 'import-kit') return await importKitCommand(parsed, io);
    if (command === 'export-csv') return await exportCsvCommand(parsed, io);
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
  io.err(`Unknown command "${given}".\n\n${USAGE}`);
  return 1;
}
