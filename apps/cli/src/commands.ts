import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import {
  ModelCalculator,
  validateModel,
  validateModelDocument,
  type Model,
  type Kit,
} from '@metakit-app/core';
import {
  exportMkModel,
  importMkModel,
  MkModelError,
  NodeFsAdapter,
  Workspace,
} from '@metakit-app/storage/node-entry';
import {
  checkFlags,
  hasFlag,
  stringFlag,
  UsageError,
  type ParsedArgs,
} from './args';
import {
  CliError,
  findKitFor,
  kitFileIn,
  readJsonFileAt,
  readKitFile,
} from './load';
import {
  exitCode,
  formatJson,
  formatText,
  type DocumentReport,
  type ReportIssue,
} from './report';

export interface Io {
  out(text: string): void;
  err(text: string): void;
}

function modelIssues(kit: Kit, model: Model): ReportIssue[] {
  // Constraints and formula attributes need the calculator; the model never changes here.
  const calculator = new ModelCalculator(kit, () => model);
  return validateModel(kit, model, calculator).map((i) => ({
    severity: i.severity,
    location: i.attr ? `${i.id}.${i.attr}` : i.id,
    code: i.code,
    message: i.message,
  }));
}

async function kindOf(
  path: string,
): Promise<'workspace' | 'kit-folder' | 'file'> {
  let info;
  try {
    info = await stat(path);
  } catch {
    throw new CliError(`"${path}" does not exist.`);
  }
  if (!info.isDirectory()) return 'file';
  const has = async (name: string) =>
    stat(join(path, name)).then(
      (s) => s.isFile(),
      () => false,
    );
  if (await has('workspace.json')) return 'workspace';
  if ((await kitFileIn(path)) !== null) return 'kit-folder';
  throw new CliError(
    `"${path}" is neither a MetaKit workspace (no workspace.json) nor a Kit folder (no kit.json or tool.json).`,
  );
}

async function validateWorkspace(root: string): Promise<DocumentReport[]> {
  // The command only reads, so it uses an instance id that never writes anything.
  const ws = await Workspace.open(new NodeFsAdapter(root));
  const reports: DocumentReport[] = [
    { path: 'workspace.json', kind: 'workspace', issues: [] },
  ];
  const kits = new Map<string, Kit>();
  // Kits made before the Kit rename are in tools/, newer ones in kits/.
  for (const { slug, folder: path } of await ws.listKitFolders()) {
    const issues: ReportIssue[] = [];
    try {
      const loaded = await ws.loadKit(slug);
      kits.set(loaded.document.manifest.id, loaded.document);
      issues.push(
        ...loaded.issues.map((i): ReportIssue => ({
          severity: 'error',
          location: i.path || '(top level)',
          message: i.message,
        })),
      );
      issues.push(
        ...loaded.warnings.map((w): ReportIssue => ({
          severity: 'warning',
          location: 'snapshots',
          message: w,
        })),
      );
    } catch (error) {
      issues.push({
        severity: 'error',
        location: '(folder)',
        message: (error as Error).message,
      });
    }
    reports.push({ path, kind: 'kit', issues });
  }
  for (const entry of await ws.adapter.list('models')) {
    if (entry.kind !== 'directory') continue;
    const path = `models/${entry.name}`;
    const issues: ReportIssue[] = [];
    try {
      const loaded = await ws.loadModel(entry.name);
      issues.push(
        ...loaded.issues.map((i): ReportIssue => ({
          severity: 'error',
          location: i.path || '(top level)',
          message: i.message,
        })),
      );
      issues.push(
        ...loaded.warnings.map((w): ReportIssue => ({
          severity: 'warning',
          location: 'snapshots',
          message: w,
        })),
      );
      const kit = kits.get(loaded.document.manifest.kit);
      if (!kit)
        issues.push({
          severity: 'error',
          location: 'manifest.kit',
          message: `The Kit ${loaded.document.manifest.kit} is not in this workspace, so the model cannot be checked.`,
        });
      else if (loaded.issues.length === 0)
        issues.push(...modelIssues(kit, loaded.document));
    } catch (error) {
      issues.push({
        severity: 'error',
        location: '(folder)',
        message: (error as Error).message,
      });
    }
    reports.push({ path, kind: 'model', issues });
  }
  return reports;
}

async function validateModelFile(
  path: string,
  kitOption: string | undefined,
): Promise<DocumentReport[]> {
  const kitPath = await findKitFor(path, kitOption);
  const { kit, issues: kitIssues } = await readKitFile(kitPath);
  const reports: DocumentReport[] = [];
  const kitIssuesOut = kitIssues.map((i): ReportIssue => ({
    severity: 'error',
    location: i.path || '(top level)',
    message: i.message,
  }));
  reports.push({ path: kitPath, kind: 'kit', issues: kitIssuesOut });
  const issues: ReportIssue[] = [];
  if (kitIssues.length > 0) {
    issues.push({
      severity: 'error',
      location: '(Kit)',
      message: `The Kit has ${kitIssues.length} problem${kitIssues.length === 1 ? '' : 's'}, so the model was not checked.`,
    });
  } else {
    try {
      const model = importMkModel(kit, await readJsonFileAt(path));
      const structure = validateModelDocument(model);
      issues.push(
        ...structure.map((i): ReportIssue => ({
          severity: 'error',
          location: i.path,
          message: i.message,
        })),
      );
      issues.push(...modelIssues(kit, model));
    } catch (error) {
      if (error instanceof MkModelError)
        issues.push(
          ...error.issues.map((i): ReportIssue => ({
            severity: 'error',
            location: i.path,
            message: i.message,
          })),
        );
      else
        issues.push({
          severity: 'error',
          location: '(file)',
          message: (error as Error).message,
        });
    }
  }
  reports.push({ path, kind: 'model', issues });
  return reports;
}

export async function validateCommand(
  args: ParsedArgs,
  io: Io,
): Promise<number> {
  checkFlags(args, ['strict', 'json', 'kit']);
  if (args.positionals.length !== 1)
    throw new UsageError(
      'validate needs exactly one path: a workspace folder, a Kit, or a model file.',
    );
  const path = args.positionals[0]!;
  const strict = hasFlag(args, 'strict');
  const kind = await kindOf(path);
  let reports: DocumentReport[];
  if (kind === 'workspace') {
    reports = await validateWorkspace(path);
  } else if (kind === 'kit-folder') {
    const { issues } = await readKitFile(path);
    reports = [
      {
        path: (await kitFileIn(path)) ?? path,
        kind: 'kit',
        issues: issues.map((i): ReportIssue => ({
          severity: 'error',
          location: i.path || '(top level)',
          message: i.message,
        })),
      },
    ];
  } else {
    const raw = await readJsonFileAt(path);
    const looksLikeKit =
      raw !== null &&
      typeof raw === 'object' &&
      'classes' in raw &&
      'manifest' in raw;
    if (looksLikeKit && !path.endsWith('.mkmodel.json')) {
      const { issues } = await readKitFile(path);
      reports = [
        {
          path,
          kind: 'kit',
          issues: issues.map((i): ReportIssue => ({
            severity: 'error',
            location: i.path || '(top level)',
            message: i.message,
          })),
        },
      ];
    } else {
      reports = await validateModelFile(path, stringFlag(args, 'kit'));
    }
  }
  io.out(
    hasFlag(args, 'json')
      ? formatJson(reports, strict)
      : `${formatText(reports)}\n`,
  );
  return exitCode(reports, strict);
}

export async function exportCommand(args: ParsedArgs, io: Io): Promise<number> {
  checkFlags(args, ['format', 'out', 'kit', 'workspace']);
  if (args.positionals.length !== 1)
    throw new UsageError(
      'export needs exactly one model: a .mkmodel.json file, or a model folder name together with --workspace.',
    );
  const format = stringFlag(args, 'format') ?? 'json';
  if (format !== 'json') {
    io.err(`Unsupported format "${format}". Supported formats: json.`);
    return 1;
  }
  const subject = args.positionals[0]!;
  const workspace = stringFlag(args, 'workspace');
  let text: string;
  if (workspace) {
    const ws = await Workspace.open(new NodeFsAdapter(workspace));
    text = await ws.exportModel(subject);
  } else {
    const kitPath = await findKitFor(subject, stringFlag(args, 'kit'));
    const { kit, issues } = await readKitFile(kitPath);
    if (issues.length > 0)
      throw new CliError(
        `The Kit "${kitPath}" has ${issues.length} problem(s); run "metakit validate ${kitPath}" to see them.`,
      );
    text = exportMkModel(
      kit,
      importMkModel(kit, await readJsonFileAt(subject)),
    );
  }
  const out = stringFlag(args, 'out');
  if (out) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, text, 'utf8');
    io.err(`Wrote ${relative(process.cwd(), out) || out}.`);
  } else {
    io.out(text);
  }
  return 0;
}

export { readFile };
