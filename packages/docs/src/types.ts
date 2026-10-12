export type CategoryId =
  | 'start'
  | 'pages'
  | 'model'
  | 'build'
  | 'behaviour'
  | 'teamwork'
  | 'assistant'
  | 'kits'
  | 'reference'
  | 'tutorials';

export interface Category {
  id: CategoryId;
  title: string;
}

/** In display order. */
export const CATEGORIES: readonly Category[] = [
  { id: 'start', title: 'Getting started' },
  { id: 'pages', title: 'Pages and dialogs' },
  { id: 'model', title: 'Model mode' },
  { id: 'build', title: 'Build mode' },
  { id: 'behaviour', title: 'Behaviour' },
  { id: 'teamwork', title: 'Sync, Git and history' },
  { id: 'assistant', title: 'Assistant' },
  { id: 'kits', title: 'Kits' },
  { id: 'reference', title: 'Reference' },
  { id: 'tutorials', title: 'Tutorials' },
];

export function isCategoryId(value: string): value is CategoryId {
  return CATEGORIES.some((c) => c.id === value);
}

export function categoryTitle(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.title ?? id;
}

export interface Topic {
  id: string;
  title: string;
  /** A string so that a wrong value in a file is reported as a problem, not a crash. */
  category: string;
  summary: string;
  keywords: string[];
  contexts: string[];
  order: number;
  /** The Markdown after the front matter. */
  body: string;
  /** Where it came from, for messages. */
  path: string;
}
