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
  /**
   * Next presses the control before moving on, so the following steps find what it opens (a
   * section, an editor). Never used for a control that changes the Kit or the model.
   */
  pressOnNext?: boolean;
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
  {
    id: 'models-page',
    title: 'Models page',
    summary:
      'Make a model, find your way through folders and search, import and export, and bring back deleted models.',
    page: 'models',
    steps: [
      {
        anchor: 'models-new',
        title: 'New model',
        text: 'Start a model here. You pick a Kit, a model type and a name.',
        placement: 'bottom',
      },
      {
        anchor: 'models-import-export',
        title: 'Import and export',
        text: 'Bring in model files and bundles that others sent you. Or save a model as a file, a bundle or a CSV table.',
        placement: 'bottom',
      },
      {
        anchor: 'models-search',
        title: 'Search across models',
        text: 'Type a word to find objects in every model of the workspace. Choose a hit to open the model right there.',
        placement: 'bottom',
        optional: true,
      },
      {
        anchor: 'models-list',
        title: 'Your models',
        text: 'Click a name to open the model. Each row also shows the Kit it is made with.',
        placement: 'bottom',
        optional: true,
      },
      {
        anchor: 'models-folder',
        title: 'Folders',
        text: 'Models are grouped by the folder you give them. Click a folder to fold it away.',
        placement: 'right',
        optional: true,
      },
      {
        anchor: 'models-actions',
        title: 'Rename, move or delete',
        text: 'The … menu of a model renames it, moves it to another folder or deletes it.',
        placement: 'left',
        optional: true,
      },
      {
        anchor: 'models-trash',
        title: 'Deleted models',
        text: 'Deleted models are kept here for 30 days. Open the list to restore one.',
        placement: 'top',
        optional: true,
      },
      {
        anchor: 'top-areas',
        title: 'Model and Build',
        text: 'Model is where you draw. Build is where Kits are added and made.',
        placement: 'bottom',
      },
    ],
  },
  {
    id: 'modelling',
    title: 'Modelling a model',
    summary:
      'Place and connect objects, fill in their attributes, and find your way around the menus, find, undo, problems and the save status.',
    page: 'model',
    needs: 'model',
    steps: [
      {
        anchor: 'model-palette',
        title: 'Palette',
        text: 'Pick a kind of object, then click on the canvas to place it. You can also drag it onto the canvas.',
        placement: 'right',
      },
      {
        anchor: 'model-relations',
        title: 'Connecting objects',
        text: 'Pick a relation, then click the first object and then the second one. Escape stops placing or connecting.',
        placement: 'right',
      },
      {
        anchor: 'model-canvas',
        title: 'Canvas',
        text: 'Click an object to select it, drag to move it, and double-click to edit its name. Right-click shows more actions.',
      },
      {
        anchor: 'model-attributes',
        title: 'Attribute panel',
        text: 'It shows the fields of what you selected. Every change is saved as you make it.',
        placement: 'left',
      },
      {
        anchor: 'model-menus',
        title: 'Menus',
        text: 'File, Edit, View, Arrange and Check hold everything you can do with the model. Commands from the Kit appear here too.',
        placement: 'bottom',
      },
      {
        anchor: 'model-check',
        title: 'Problems',
        text: 'Check, then Problems, lists what does not follow the rules of the Kit. A number shows how many there are.',
        placement: 'bottom',
      },
      {
        anchor: 'model-find',
        title: 'Find',
        text: 'Type to find objects in this model by name or by an attribute. Ctrl+F jumps here.',
        placement: 'bottom',
      },
      {
        anchor: 'model-undo',
        title: 'Undo and redo',
        text: 'Undo takes back your last change and Redo brings it back. Ctrl+Z and Ctrl+Shift+Z do the same.',
        placement: 'bottom',
      },
      {
        anchor: 'model-save',
        title: 'Save status',
        text: 'MetaKit saves every change by itself. This shows Saving… and then Saved.',
        placement: 'bottom',
      },
      {
        anchor: 'model-people',
        title: 'People',
        text: 'Everyone who has this model open is shown here, each in their own colour.',
        placement: 'bottom',
      },
      {
        anchor: 'model-back',
        title: 'Back to Models',
        text: 'Returns to the list of models. The model stays as you left it.',
        placement: 'bottom',
      },
    ],
  },
  {
    id: 'kits-page',
    title: 'Kits page',
    summary:
      'Your Kits and the built-in ones: use one as it is, copy and extend it, make a new Kit, or add one from a file or Git.',
    page: 'kits',
    steps: [
      {
        anchor: 'kits-workspace',
        title: 'Your Kits',
        text: 'These are the Kits of this workspace. Everyone who has the folder uses the same ones.',
        placement: 'bottom',
      },
      {
        anchor: 'kits-add',
        title: 'Add from a file or Git',
        text: 'Bring in a Kit someone sent you as a file. Or open one kept in a GitHub or GitLab repository.',
        placement: 'bottom',
      },
      {
        anchor: 'kits-new',
        title: 'New Kit',
        text: 'Make a Kit from scratch, or start from a copy of another one.',
        placement: 'bottom',
      },
      {
        anchor: 'kits-edit',
        title: 'Edit a Kit',
        text: 'Edit opens the Kit in Build, where you change its classes, shapes and rules.',
        placement: 'right',
        optional: true,
      },
      {
        anchor: 'kits-built-in',
        title: 'Built-in Kits',
        text: 'Ready-made Kits that come with MetaKit, listed by domain, with a search above them. They are read-only here.',
        placement: 'bottom',
      },
      {
        anchor: 'kits-use',
        title: 'Use in this workspace',
        text: 'Adds the Kit to this workspace as it is, so you can make models with it.',
        placement: 'right',
        optional: true,
      },
      {
        anchor: 'kits-copy',
        title: 'Copy and extend',
        text: 'Makes your own Kit based on this one. You can then change it in Build.',
        placement: 'right',
      },
    ],
  },
  {
    id: 'building-kit',
    title: 'Building a Kit',
    summary:
      'The sections of a Kit, adding classes yourself or from the catalog, the class editor and its attributes, Try it, undo and source control.',
    page: 'build',
    needs: 'kit',
    steps: [
      {
        anchor: 'build-sections',
        title: 'Sections',
        text: 'A Kit is made of classes, relation classes and model types, their appearance, their behaviour and its settings. Pick a part here.',
        placement: 'right',
      },
      {
        anchor: 'build-tab-classes',
        title: 'Classes',
        text: 'A class is one kind of object, such as Task. Next opens this section.',
        placement: 'right',
        pressOnNext: true,
      },
      {
        anchor: 'build-new',
        title: 'Add a class',
        text: 'Type a name and choose Add. The new class opens in the editor.',
        placement: 'right',
      },
      {
        anchor: 'build-catalog',
        title: 'Add from catalog',
        text: 'Pick ready-made classes such as Dataset or Risk, with their attributes and looks.',
        placement: 'right',
      },
      {
        anchor: 'build-item',
        title: 'A class of this Kit',
        text: 'Choose a class to edit it; the ✕ next to it deletes it. Next opens this one.',
        placement: 'right',
        optional: true,
        pressOnNext: true,
      },
      {
        anchor: 'build-editor',
        title: 'Class editor',
        text: 'The name, label, kind and help text of the class, then its appearance and constraints. Every change is saved at once.',
        placement: 'left',
      },
      {
        anchor: 'build-attributes',
        title: 'Attributes',
        text: 'The fields a modeller fills in for each object, such as Owner or Status. Add one at the end of the list.',
        placement: 'left',
        optional: true,
      },
      {
        anchor: 'build-try',
        title: 'Try it',
        text: 'Opens a small throw-away model beside the editor. You can place and connect objects of the Kit as you build it.',
        placement: 'bottom',
      },
      {
        anchor: 'build-undo',
        title: 'Undo and redo',
        text: 'Every change to the Kit can be taken back. Undo and Redo work here as in a model.',
        placement: 'bottom',
      },
      {
        anchor: 'build-git',
        title: 'Source control',
        text: 'For a Kit kept in GitHub or GitLab: commit and push, pull, and pick a release.',
        placement: 'bottom',
        optional: true,
      },
      {
        anchor: 'build-back',
        title: 'Back to Kits',
        text: 'Returns to the Kits page. The Kit is already saved.',
        placement: 'bottom',
      },
    ],
  },
  {
    id: 'appearance',
    title: 'Appearance',
    summary:
      'How a class looks: the base form, colours, colour by attribute, badges, and the drawing editor for anything else.',
    page: 'build',
    needs: 'kit',
    steps: [
      {
        anchor: 'build-tab-classes',
        title: 'Classes',
        text: 'A look belongs to a class. Next opens the Classes section.',
        placement: 'right',
        pressOnNext: true,
      },
      {
        anchor: 'build-item',
        title: 'Pick a class',
        text: 'Choose the class whose look you want to change. Next picks this one.',
        placement: 'right',
        optional: true,
        pressOnNext: true,
      },
      {
        anchor: 'build-appearance',
        title: 'Appearance of a class',
        text: 'This shows how objects of the selected class look on the canvas. A form, colours and text are enough, no drawing needed.',
        placement: 'bottom',
      },
      {
        anchor: 'build-edit-appearance',
        title: 'Edit appearance',
        text: 'Opens the appearance editor. Next opens it for you.',
        placement: 'bottom',
        optional: true,
        pressOnNext: true,
      },
      {
        anchor: 'appearance-form',
        title: 'Base form',
        text: 'Choose the basic form, such as a box, a rounded box, a circle or a diamond.',
        placement: 'right',
        optional: true,
      },
      {
        anchor: 'appearance-preview',
        title: 'Preview',
        text: 'Shows the look as it will be drawn. When a colour follows data, a tile shows each value.',
        placement: 'right',
        optional: true,
      },
      {
        anchor: 'appearance-colours',
        title: 'Colours',
        text: 'Set the fill, the border and the text colour, and the width and style of the border.',
        placement: 'left',
        optional: true,
      },
      {
        anchor: 'appearance-data',
        title: 'Colour by attribute',
        text: 'Let a colour follow the value of an attribute, for example red when Status is Late.',
        placement: 'left',
        optional: true,
      },
      {
        anchor: 'appearance-badge',
        title: 'Badges',
        text: 'Show a small mark on the shape when an attribute has a given value.',
        placement: 'left',
        optional: true,
      },
      {
        anchor: 'appearance-done',
        title: 'Done',
        text: 'Closes the editor; every change is already in the Kit. Next closes it for you.',
        placement: 'bottom',
        optional: true,
        pressOnNext: true,
      },
      {
        anchor: 'build-more-looks',
        title: 'The drawing editor',
        text: 'For a look no form can give, open More ways to set the look. New drawn shape opens the advanced drawing editor.',
        placement: 'top',
      },
    ],
  },
  {
    id: 'rules-scripts',
    title: 'Rules and scripts',
    summary:
      'Rules with When, If and Then, commands people can run, and scripts with the permissions they need.',
    page: 'build',
    needs: 'kit',
    steps: [
      {
        anchor: 'build-tab-rules',
        title: 'Rules',
        text: 'A rule reacts when something happens in a model. Next opens the Rules section.',
        placement: 'right',
        pressOnNext: true,
      },
      {
        anchor: 'rules-row',
        title: 'A rule',
        text: 'Each row is one rule, and its switch turns it on or off. Next opens the first rule.',
        placement: 'bottom',
        optional: true,
        pressOnNext: true,
      },
      {
        anchor: 'rule-when',
        title: 'When',
        text: 'The event the rule waits for, such as an object being created or an attribute changing.',
        placement: 'left',
        optional: true,
      },
      {
        anchor: 'rule-command',
        title: 'Commands',
        text: 'Choose "A person runs it" as the event to make a command. It then appears in the Commands menu, on the toolbar or in the right-click menu.',
        placement: 'left',
        optional: true,
      },
      {
        anchor: 'rule-if',
        title: 'If',
        text: 'A condition written as a formula. The rule acts only when it is true, or always when it is empty.',
        placement: 'left',
        optional: true,
      },
      {
        anchor: 'rule-then',
        title: 'Then',
        text: 'The actions the rule takes, such as setting a value or showing a message.',
        placement: 'left',
        optional: true,
      },
      {
        anchor: 'rules-add',
        title: 'Add rule',
        text: 'Makes a new rule. Once the assistant is set up, it can draft one for you.',
        placement: 'top',
      },
      {
        anchor: 'build-tab-scripts',
        title: 'Scripts',
        text: 'Scripts are TypeScript for what formulas and rules cannot do. Next opens the Scripts section.',
        placement: 'right',
        pressOnNext: true,
      },
      {
        anchor: 'scripts-list',
        title: 'Your scripts',
        text: 'Each script can be switched off, renamed or deleted. Add a script makes a new one.',
        placement: 'right',
      },
      {
        anchor: 'scripts-editor',
        title: 'Script editor',
        text: 'Write the script here; the editor completes names and marks mistakes. The console below shows what scripts print.',
        placement: 'left',
      },
      {
        anchor: 'scripts-permissions',
        title: 'Permissions',
        text: 'Say whether the scripts may use the internet or files. Each person is asked once, in their own browser.',
        placement: 'top',
      },
    ],
  },
  {
    id: 'help-settings',
    title: 'Help and settings',
    summary:
      'The Help side bar, the documentation, the appearance, your name and colour, Git and the assistant.',
    page: 'any',
    steps: [
      {
        anchor: 'top-help',
        title: 'Help side bar',
        text: 'Help opens the topic for the page you are on, beside your work. F1 opens and closes it from anywhere.',
        placement: 'bottom',
      },
      {
        anchor: 'top-docs',
        title: 'Documentation',
        text: 'All help topics on a page of their own, with search. Your work stays open underneath.',
        placement: 'bottom',
      },
      {
        anchor: 'top-tutorials',
        title: 'Tutorials',
        text: 'The guided tours and the written tutorials. Come back here any time.',
        placement: 'bottom',
      },
      {
        anchor: 'top-settings',
        title: 'Settings',
        text: 'Settings holds what belongs to you and this browser, not to a model or a Kit.',
        placement: 'bottom',
      },
      {
        anchor: 'settings-theme',
        title: 'Appearance',
        text: 'Choose Light or Dark. System follows the setting of your computer.',
        placement: 'left',
      },
      {
        anchor: 'settings-profile',
        title: 'Your name and colour',
        text: 'Others see them next to the models you have open. They are kept in this browser.',
        placement: 'left',
      },
      {
        anchor: 'settings-git',
        title: 'Git',
        text: 'Connect to GitHub or GitLab to keep Kits in a repository. Your token stays in this browser.',
        placement: 'left',
      },
      {
        anchor: 'settings-assistant',
        title: 'Assistant',
        text: 'The assistant drafts changes to a Kit with your own API key. It is off until you set it up.',
        placement: 'left',
      },
    ],
  },
];

export function tourById(id: string): Tour | undefined {
  return TOURS.find((t) => t.id === id);
}
