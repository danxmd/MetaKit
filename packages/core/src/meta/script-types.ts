/** Identifier of a script of a Kit (ADR 0006). */
export type ScriptId = `scr_${string}`;

/** What a Kit may ask the person for; the app asks once per Kit in each browser. */
export interface KitPermissions {
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
