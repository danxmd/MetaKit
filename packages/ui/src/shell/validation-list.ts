import {
  effectiveAttributes,
  effectiveRelationAttributes,
  type Model,
  type Severity,
  type ToolLibrary,
  type ValidationIssue,
} from '@metakit-app/core';

export interface TargetInfo {
  kind: 'element' | 'connector' | 'model' | 'missing';
  /** What to call the object: its first text value, or its class name when it has none. */
  name: string;
  /** The class (or relation, or model type) it belongs to; empty when that is unknown. */
  className: string;
}

export interface IssueRow {
  /** Stable within one list, so the view can key on it. */
  key: string;
  issue: ValidationIssue;
  target: TargetInfo;
}

export interface IssueGroup {
  severity: Severity;
  /** The heading, such as "Errors". */
  title: string;
  rows: IssueRow[];
}

export const SEVERITIES: readonly Severity[] = ['error', 'warning', 'info'];

const TITLES: Record<Severity, string> = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Notes',
};

function firstText(
  attrs: Record<string, unknown>,
  defs: { id: string; type: string }[],
): string | undefined {
  for (const def of defs) {
    const value = attrs[def.id];
    if (def.type === 'text' && typeof value === 'string' && value !== '')
      return value;
  }
  return undefined;
}

/** A broken class chain has no attributes; the list must still show the issue. */
function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/** Names the object an issue belongs to, for people. Works for deleted objects and unknown classes. */
export function describeTarget(
  id: ValidationIssue['id'],
  model: Model,
  tool: ToolLibrary,
  language = 'en',
): TargetInfo {
  if (id === 'model') {
    const type = tool.modelTypes[model.manifest.modelType];
    return {
      kind: 'model',
      name: model.manifest.name,
      className: type ? (type.labels?.[language] ?? type.key) : '',
    };
  }
  const element = model.elements[id as keyof Model['elements']];
  if (element) {
    const cls = tool.classes[element.class];
    const className = cls ? (cls.labels[language] ?? cls.key) : '';
    const defs = safely(() => effectiveAttributes(tool, element.class), []);
    return {
      kind: 'element',
      name: firstText(element.attrs, defs) ?? (className || element.id),
      className,
    };
  }
  const connector = model.connectors[id as keyof Model['connectors']];
  if (connector) {
    const rel = tool.relations[connector.relation];
    const className = rel ? (rel.labels[language] ?? rel.key) : '';
    const defs = safely(
      () => effectiveRelationAttributes(tool, connector.relation),
      [],
    );
    return {
      kind: 'connector',
      name: firstText(connector.attrs, defs) ?? (className || connector.id),
      className,
    };
  }
  return { kind: 'missing', name: String(id), className: '' };
}

export function rowsOf(
  issues: readonly ValidationIssue[],
  model: Model,
  tool: ToolLibrary,
  language = 'en',
): IssueRow[] {
  return issues.map((issue, i) => ({
    key: `${i}:${issue.id}:${issue.code}:${issue.attr ?? ''}`,
    issue,
    target: describeTarget(issue.id, model, tool, language),
  }));
}

/** True when the row's text contains every word of the query, ignoring case. */
function matches(row: IssueRow, words: string[]): boolean {
  if (words.length === 0) return true;
  const haystack = [
    row.issue.message,
    row.issue.code,
    row.target.name,
    row.target.className,
  ]
    .join(' ')
    .toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/**
 * Keeps the rows of the shown severities whose message, code, object name or class contain every
 * word of the query. An empty query keeps everything of those severities.
 */
export function filterIssues(
  rows: readonly IssueRow[],
  query: string,
  severities: ReadonlySet<Severity> = new Set(SEVERITIES),
): IssueRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(
    (row) => severities.has(row.issue.severity) && matches(row, words),
  );
}

/** Groups rows by severity, worst first. Empty groups are left out; unknown severities count as notes. */
export function groupIssues(rows: readonly IssueRow[]): IssueGroup[] {
  const groups = new Map<Severity, IssueRow[]>();
  for (const row of rows) {
    const severity = SEVERITIES.includes(row.issue.severity)
      ? row.issue.severity
      : 'info';
    const list = groups.get(severity) ?? [];
    list.push(row);
    groups.set(severity, list);
  }
  return SEVERITIES.filter((s) => groups.has(s)).map((severity) => ({
    severity,
    title: TITLES[severity],
    rows: groups.get(severity)!,
  }));
}

export function countBySeverity(
  issues: readonly ValidationIssue[],
): Record<Severity, number> {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const issue of issues)
    counts[SEVERITIES.includes(issue.severity) ? issue.severity : 'info']++;
  return counts;
}

/** The sentence for the panel header, e.g. "2 errors, 3 warnings". */
export function summarise(counts: Record<Severity, number>): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  };
  add(counts.error, 'error', 'errors');
  add(counts.warning, 'warning', 'warnings');
  add(counts.info, 'note', 'notes');
  return parts.length === 0 ? 'No problems found.' : parts.join(', ');
}
