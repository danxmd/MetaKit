import { describeOutgoing } from '@metakit-app/assistant';
import {
  createEmptyKit,
  newId,
  type ClassDef,
  type Kit,
} from '@metakit-app/core';

/** The short statement the settings page shows next to the sample. */
export const WHAT_IS_SENT =
  'What is sent: Kit definitions, never models. Each request holds your description and a summary of the Kit you are editing (class, relation class and attribute names and types, existing rule and shape names) and the format the draft must follow. It never holds the objects, attribute values or names of any model.';

export const KEY_STATEMENT =
  'Your key stays in this browser. It is kept in this browser profile only (IndexedDB), never in the shared folder, a repository or a log. The requests go straight from this page to the service you chose, with your key; there is no server in between. Anyone who can run code on this page could read the key, so use a key with a spending limit and remove it when you no longer need it.';

export const COST_NOTE =
  'Each draft is one request, or two when the first draft needs a correction. The service bills them to your own account. The sample below shows how much text one request holds.';

/** A small Kit for the sample: shows what a request looks like without any real Kit. */
export function sampleKitForNotice(): Kit {
  const kit = createEmptyKit({ name: 'Example Kit' });
  const id = newId('class');
  const task: ClassDef = {
    id,
    key: 'Task',
    kind: 'node',
    labels: { en: 'Task' },
    attributes: [
      { id: newId('attribute'), key: 'Name', type: 'text', required: true },
      {
        id: newId('attribute'),
        key: 'Priority',
        type: 'choice',
        options: ['Low', 'Medium', 'High'],
      },
      { id: newId('attribute'), key: 'Owner', type: 'text' },
    ],
  };
  kit.classes[id] = task;
  return kit;
}

/** The exact text that a request for a rule would send for the given Kit. */
export function sampleOutgoing(kit: Kit = sampleKitForNotice()): string {
  return describeOutgoing(kit, 'rule', 'High-priority tasks need an owner')
    .text;
}
