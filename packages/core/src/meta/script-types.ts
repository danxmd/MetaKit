/** Identifier of a script of a tool library (ADR 0006). */
export type ScriptId = `scr_${string}`;

/** What a tool may ask the person for; the app asks once per tool in each browser. */
export interface ToolPermissions {
  /** Scripts may call web services (`http`). */
  network?: boolean;
  /** Scripts may open and save files outside the workspace, through dialogs (`files`). */
  files?: boolean;
}

export interface Script {
  id: ScriptId;
  /** Shown in lists and in the console. */
  name: string;
  /** TypeScript. Compiled with sucrase when it is saved or loaded; types are not checked at run time. */
  source: string;
  /** Scripts are on unless this is false. */
  enabled?: boolean;
}
