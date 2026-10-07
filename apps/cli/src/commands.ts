import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import {
  ModelCalculator,
  validateModel,
  validateModelDocument,
  type Model,
  type ToolLibrary,
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
import { CliError, findToolFor, readJsonFileAt, readToolFile } from './load';
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

function modelIssues(tool: ToolLibrary, model: Model): ReportIssue[] {
  // Constraints and formula attributes need the calculator; the model never changes here.
  const calculator = new ModelCalculator(tool, () => model);
  return validateModel(tool, model, calculator).map((i) => ({
    severity: i.severity,
    location: i.attr ? `${i.id}.${i.attr}` : i.id,
    code: i.code,
    message: i.message,
  }));
}

async function kindOf(
  path: string,
): Promise<'workspace' | 'tool-folder' | 'file'> {
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
  if (await has('tool.json')) return 'tool-folder';
  throw new CliError(
    `"${path}" is neither a MetaKit workspace (no workspace.json) nor a tool library folder (no tool.json).`,
  );
}

async function validateWorkspace(root: string): Promise<DocumentReport[]> {
  // The command only reads, so it uses an instance id that never writes anything.
  const ws = await Workspace.open(new NodeFsAdapter(root));
  const reports: DocumentReport[] = [
    { path: 'workspace.json', kind: 'workspace', issues: [] },
  ];
  const tools = new Map<string, ToolLibrary>();
  for (const entry of await ws.adapter.list('tools')) {
    if (entry.kind !== 'directory') continue;
    const path = `tools/${entry.name}`;
    const issues: ReportIssue[] = [];
    try {
      const loaded = await ws.loadTool(entry.name);
      tools.set(loaded.document.manifest.id, loaded.document);
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
    reports.push({ path, kind: 'tool', issues });
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
      const tool = tools.get(loaded.document.manifest.tool);
      if (!tool)
        issues.push({
          severity: 'error',
          location: 'manifest.tool',
          message: `The tool library ${loaded.document.manifest.tool} is not in this workspace, so the model cannot be checked.`,
        });
      else if (loaded.issues.length === 0)
        issues.push(...modelIssues(tool, loaded.document));
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
  toolOption: string | undefined,
): Promise<DocumentReport[]> {
  const toolPath = await findToolFor(path, toolOption);
  const { tool, issues: toolIssues } = await readToolFile(toolPath);
  const reports: DocumentReport[] = [];
  const toolIssuesOut = toolIssues.map((i): ReportIssue => ({
    severity: 'error',
    location: i.path || '(top level)',
    message: i.message,
  }));
  reports.push({ path: toolPath, kind: 'tool', issues: toolIssuesOut });
  const issues: ReportIssue[] = [];
  if (toolIssues.length > 0) {
    issues.push({
      severity: 'error',
      location: '(tool)',
      message: `The tool library has ${toolIssues.length} problem${toolIssues.length === 1 ? '' : 's'}, so the model was not checked.`,
    });
  } else {
    try {
      const model = importMkModel(tool, await readJsonFileAt(path));
      const structure = validateModelDocument(model);
      issues.push(
        ...structure.map((i): ReportIssue => ({
          severity: 'error',
          location: i.path,
          message: i.message,
        })),
      );
      issues.push(...modelIssues(tool, model));
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
  checkFlags(args, ['strict', 'json', 'tool']);
  if (args.positionals.length !== 1)
    throw new UsageError(
      'validate needs exactly one path: a workspace folder, a tool library, or a model file.',
    );
  const path = args.positionals[0]!;
  const strict = hasFlag(args, 'strict');
  const kind = await kindOf(path);
  let reports: DocumentReport[];
  if (kind === 'workspace') {
    reports = await validateWorkspace(path);
  } else if (kind === 'tool-folder') {
    const { issues } = await readToolFile(path);
    reports = [
      {
        path: join(path, 'tool.json'),
        kind: 'tool',
        issues: issues.map((i): ReportIssue => ({
          severity: 'error',
          location: i.path || '(top level)',
          message: i.message,
        })),
      },
    ];
  } else {
    const raw = await readJsonFileAt(path);
    const looksLikeTool =
      raw !== null &&
      typeof raw === 'object' &&
      'classes' in raw &&
      'manifest' in raw;
    if (looksLikeTool && !path.endsWith('.mkmodel.json')) {
      const { issues } = await readToolFile(path);
      reports = [
        {
          path,
          kind: 'tool',
          issues: issues.map((i): ReportIssue => ({
            severity: 'error',
            location: i.path || '(top level)',
            message: i.message,
          })),
        },
      ];
    } else {
      reports = await validateModelFile(path, stringFlag(args, 'tool'));
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
  checkFlags(args, ['format', 'out', 'tool', 'workspace']);
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
    const toolPath = await findToolFor(subject, stringFlag(args, 'tool'));
    const { tool, issues } = await readToolFile(toolPath);
    if (issues.length > 0)
      throw new CliError(
        `The tool library "${toolPath}" has ${issues.length} problem(s); run "metakit validate ${toolPath}" to see them.`,
      );
    text = exportMkModel(
      tool,
      importMkModel(tool, await readJsonFileAt(subject)),
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
