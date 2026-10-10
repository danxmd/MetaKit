/**
 * The guided tours. Each step points at a control by its `data-tour` anchor, which is kept apart
 * from test ids so that renaming a test does not break a tour. Texts are plain English and at most
 * two sentences.
 *
 * This file holds the texts, so it is loaded only when the Tutorials page or a tour opens.
 */

/** The page a tour belongs to. `any` works on every workspace page. */
export type TourPage = 'start' | 'models' | 'model' | 'kits' | 'build' | 'any';

export type Placement = 'right' | 'left' | 'top' | 'bottom';

export interface Step {
  /** The value of the `data-tour` attribute of the control. */
  anchor: string;
  title: string;
  text: string;
  /** The preferred side of the pop-up; another side is used when it does not fit. */
  placement?: Placement;
  /** Skipped when the control is not on the page, instead of saying it is missing. */
  optional?: boolean;
}

export interface Tour {
  id: string;
  title: string;
  summary: string;
  page: TourPage;
  /** Something that must be open first. */
  needs?: 'model' | 'kit';
  steps: Step[];
}

export const FIRST_STEPS = 'first-steps';

export const TOURS: readonly Tour[] = [
  {
    id: FIRST_STEPS,
    title: 'First steps',
    summary:
      'Open or create a workspace folder, find Help, and see the three steps from a folder to a model.',
    page: 'start',
    steps: [
      {
        anchor: 'start-open',
        title: 'Open a workspace folder',
        text: 'Pick a folder on your computer to keep your Kits and models in. Choose an empty folder to start a new workspace.',
        placement: 'bottom',
      },
      {
        anchor: 'start-workspace',
        title: 'What a workspace folder is',
        text: 'It is a normal folder of plain files. Keep it in OneDrive, SharePoint, Google Drive or Dropbox to share it with your team.',
        placement: 'left',
      },
      {
        anchor: 'start-steps',
        title: 'Three steps',
        text: 'Open a folder, add or build a Kit, then draw models with it. The Kits page and the Models page are where steps two and three happen.',
        placement: 'left',
      },
      {
        anchor: 'start-help',
        title: 'Help on every page',
        text: 'Help opens the topic for the page you are on. Press F1 anywhere to open or close it.',
        placement: 'bottom',
      },
      {
        anchor: 'start-tutorials',
        title: 'Tutorials',
        text: 'Come back here to take another tour or to read a step-by-step tutorial.',
        placement: 'bottom',
      },
    ],
  },
];

export function tourById(id: string): Tour | undefined {
  return TOURS.find((t) => t.id === id);
}
