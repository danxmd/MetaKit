export interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string | true>;
}

/** Flags that take a value; anything else starting with `--` is a switch. */
const WITH_VALUE = new Set(['tool', 'workspace', 'out', 'format']);

export class UsageError extends Error {}

export function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--') {
      positionals.push(...args.slice(i + 1));
      break;
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split(/=(.*)/s, 2) as [
      string,
      string | undefined,
    ];
    if (WITH_VALUE.has(name)) {
      const value = inline ?? args[++i];
      if (value === undefined || value.startsWith('--'))
        throw new UsageError(`--${name} needs a value.`);
      flags.set(name, value);
    } else {
      if (inline !== undefined)
        throw new UsageError(`--${name} does not take a value.`);
      flags.set(name, true);
    }
  }
  return { positionals, flags };
}

export function stringFlag(args: ParsedArgs, name: string): string | undefined {
  const v = args.flags.get(name);
  return typeof v === 'string' ? v : undefined;
}

export function hasFlag(args: ParsedArgs, name: string): boolean {
  return args.flags.has(name);
}

export function checkFlags(args: ParsedArgs, allowed: readonly string[]): void {
  for (const name of args.flags.keys()) {
    if (!allowed.includes(name))
      throw new UsageError(`Unknown option --${name}.`);
  }
}
