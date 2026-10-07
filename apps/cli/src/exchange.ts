import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { Model, ToolLibrary } from '@metakit-app/core';
import {
  applyToolUpdate,
  exportBundle,
  exportCsv,
  exportCsvZip,
  exportToolPackage,
  exportToolPackageFrom,
  importBundle,
  importMkModel,
  NodeFsAdapter,
  prepareToolImport,
  Workspace,
} from '@metakit-app/storage/node-entry';
import {
  checkFlags,
  hasFlag,
  stringFlag,
  UsageError,
  type ParsedArgs,
} from './args';
import type { Io } from './commands';
import { CliError, findToolFor, readJsonFileAt, readToolFile } from './load';

function need(args: ParsedArgs, name: string, command: string): string {
  const value = stringFlag(args, name);
  if (!value) throw new UsageError(`${command} needs --${name} <value>.`);
  return value;
}

/** Opens the workspace folder; with --create a folder that is not a workspace yet becomes one. */
async function openWorkspace(
  folder: string,
  create: boolean,
): Promise<Workspace> {
  const adapter = new NodeFsAdapter(folder);
  if (create && !(await adapter.exists('workspace.json')))
    return Workspace.create(adapter, { name: basename(folder) || 'Workspace' });
  return Workspace.open(adapter);
}

async function writeOut(path: string, data: Uint8Array | string, io: Io) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
  io.err(`Wrote ${path}.`);
}

export async function exportBundleCommand(
  args: ParsedArgs,
  io: Io,
): Promise<number> {
  checkFlags(args, ['workspace', 'out', 'name', 'no-tool']);
  const ws = await openWorkspace(
    need(args, 'workspace', 'export-bundle'),
    false,
  );
  const out = need(args, 'out', 'export-bundle');
  const models = args.positionals.length
    ? args.positionals
    : (await ws.listModels()).map((m) => m.slug);
  if (models.length === 0)
    throw new CliError('The workspace has no models to put in a bundle.');
  const name = stringFlag(args, 'name');
  const { bytes } = await exportBundle(ws, {
    models,
    includeTool: !hasFlag(args, 'no-tool'),
    ...(name ? { name } : {}),
  });
  await writeOut(out, bytes, io);
  return 0;
}

export async function importBundleCommand(
  args: ParsedArgs,
  io: Io,
): Promise<number> {
  checkFlags(args, ['workspace', 'create']);
  if (args.positionals.length !== 1)
    throw new UsageError('import-bundle needs exactly one .mkbundle file.');
  const ws = await openWorkspace(
    need(args, 'workspace', 'import-bundle'),
    hasFlag(args, 'create'),
  );
  const bytes = new Uint8Array(await readFile(args.positionals[0]!));
  const report = await importBundle(ws, bytes);
  for (const line of report.messages) io.out(line);
  return report.skipped.length > 0 ? 1 : 0;
}

export async function exportToolCommand(
  args: ParsedArgs,
  io: Io,
): Promise<number> {
  checkFlags(args, ['workspace', 'out']);
  if (args.positionals.length !== 1)
    throw new UsageError(
      'export-tool needs one tool library: its folder name together with --workspace, or the path of a tool library.',
    );
  const out = need(args, 'out', 'export-tool');
  const subject = args.positionals[0]!;
  const workspace = stringFlag(args, 'workspace');
  let bytes: Uint8Array;
  if (workspace) {
    bytes = (
      await exportToolPackageFrom(
        await openWorkspace(workspace, false),
        subject,
      )
    ).bytes;
  } else {
    const { tool, issues } = await readToolFile(subject);
    if (issues.length > 0)
      throw new CliError(
        `The tool library "${subject}" has ${issues.length} problem(s); run "metakit validate ${subject}" to see them.`,
      );
    bytes = exportToolPackage(tool).bytes;
  }
  await writeOut(out, bytes, io);
  return 0;
}

export async function importToolCommand(
  args: ParsedArgs,
  io: Io,
): Promise<number> {
  checkFlags(args, ['workspace', 'create', 'yes']);
  if (args.positionals.length !== 1)
    throw new UsageError('import-tool needs exactly one .mktool file.');
  const ws = await openWorkspace(
    need(args, 'workspace', 'import-tool'),
    hasFlag(args, 'create'),
  );
  const bytes = new Uint8Array(await readFile(args.positionals[0]!));
  const prepared = await prepareToolImport(ws, bytes);
  for (const line of prepared.plan.lines) io.out(line);
  for (const warning of prepared.plan.warnings) io.out(`Warning: ${warning}`);
  // Replacing a library changes every model made with it, so it needs a yes.
  if (!prepared.plan.isNew && !hasFlag(args, 'yes')) {
    io.err(
      'Nothing was changed. Run the command again with --yes to apply this update.',
    );
    return 1;
  }
  const { slug, created } = await applyToolUpdate(ws, prepared);
  io.out(
    created
      ? `Added the tool library as tools/${slug}.`
      : `Updated the tool library tools/${slug}.`,
  );
  return 0;
}

export async function exportCsvCommand(
  args: ParsedArgs,
  io: Io,
): Promise<number> {
  checkFlags(args, ['workspace', 'tool', 'out', 'bom']);
  if (args.positionals.length !== 1)
    throw new UsageError(
      'export-csv needs exactly one model: a .mkmodel.json file, or a model folder name together with --workspace.',
    );
  const out = need(args, 'out', 'export-csv');
  const subject = args.positionals[0]!;
  const workspace = stringFlag(args, 'workspace');
  let tool: ToolLibrary;
  let model: Model;
  if (workspace) {
    const ws = await openWorkspace(workspace, false);
    model = (await ws.loadModel(subject)).document;
    const slug = await ws.findToolSlug(model.manifest.tool);
    if (!slug)
      throw new CliError(
        `The tool library ${model.manifest.tool} of this model is not in the workspace.`,
      );
    tool = (await ws.loadTool(slug)).document;
  } else {
    const toolPath = await findToolFor(subject, stringFlag(args, 'tool'));
    const read = await readToolFile(toolPath);
    if (read.issues.length > 0)
      throw new CliError(
        `The tool library "${toolPath}" has ${read.issues.length} problem(s); run "metakit validate ${toolPath}" to see them.`,
      );
    tool = read.tool;
    model = importMkModel(tool, await readJsonFileAt(subject));
  }
  const options = { bom: hasFlag(args, 'bom') };
  if (out.endsWith('.zip')) {
    await writeOut(out, exportCsvZip(tool, model, options), io);
  } else {
    for (const [name, text] of Object.entries(exportCsv(tool, model, options)))
      await writeOut(join(out, name), text, io);
  }
  return 0;
}
