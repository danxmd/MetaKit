/**
 * The page ids the app reports to the Help side bar. Each needs a topic that lists it in its
 * `contexts` (checked by the tests of this package).
 */
export const DOC_CONTEXTS = [
  'start',
  'models',
  'tool-libraries',
  'model',
  'docs',
  'build',
  'build.classes',
  'build.relations',
  'build.modelTypes',
  'build.shapes',
  'build.rules',
  'build.scripts',
  'build.settings',
  'build.panel-layout',
  'build.appearance',
  'build.shape-editor',
  'dialog.new-model',
  'dialog.tool-import',
  'dialog.export',
  'dialog.permission',
  'settings.git',
  'settings.assistant',
  'settings.profile',
  'git.commit',
  'git.conflict',
  'git.releases',
] as const;

export type DocContext = (typeof DOC_CONTEXTS)[number];

export function isDocContext(value: string): value is DocContext {
  return (DOC_CONTEXTS as readonly string[]).includes(value);
}
