export type Severity = 'error' | 'warning' | 'info';

export interface ReportIssue {
  severity: Severity;
  /** Where in the document: a path in the file, or the id of an element or connector. */
  location: string;
  /** A stable code when there is one (model checks have them). */
  code?: string;
  message: string;
}

export interface DocumentReport {
  /** The file or folder, as given or relative to the workspace. */
  path: string;
  /** "kit" since the Kit rename; releases before it said "tool". */
  kind: 'workspace' | 'kit' | 'model';
  issues: ReportIssue[];
}

export interface Summary {
  errors: number;
  warnings: number;
  notes: number;
  documents: number;
}

export function summarize(reports: readonly DocumentReport[]): Summary {
  const all = reports.flatMap((r) => r.issues);
  return {
    errors: all.filter((i) => i.severity === 'error').length,
    warnings: all.filter((i) => i.severity === 'warning').length,
    notes: all.filter((i) => i.severity === 'info').length,
    documents: reports.length,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function formatText(reports: readonly DocumentReport[]): string {
  const lines: string[] = [];
  for (const report of reports) {
    lines.push(
      `${report.path} (${report.kind === 'kit' ? 'Kit' : report.kind})${report.issues.length === 0 ? ': ok' : ''}`,
    );
    for (const issue of report.issues) {
      lines.push(
        `  ${issue.severity.padEnd(7)} ${issue.location}${issue.code ? ` [${issue.code}]` : ''}: ${issue.message}`,
      );
    }
  }
  const s = summarize(reports);
  lines.push(
    '',
    `${plural(s.errors, 'error')}, ${plural(s.warnings, 'warning')}, ${plural(s.notes, 'note')} in ${plural(s.documents, 'document')}.`,
  );
  return lines.join('\n');
}

export function formatJson(
  reports: readonly DocumentReport[],
  strict: boolean,
): string {
  const summary = summarize(reports);
  return `${JSON.stringify({ ok: summary.errors === 0 && (!strict || summary.warnings === 0), strict, summary, documents: reports }, null, 2)}\n`;
}

export function exitCode(
  reports: readonly DocumentReport[],
  strict: boolean,
): number {
  const s = summarize(reports);
  return s.errors > 0 || (strict && s.warnings > 0) ? 1 : 0;
}
