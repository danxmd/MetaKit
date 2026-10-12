---
id: business-model-canvas
title: Business model canvas
category: kits
summary: A built-in Kit for business model canvases, with the nine blocks as containers, items inside them, how well each is tested, annual amounts and links between items.
keywords: [business model canvas, business model, canvas block, value proposition, customer segment, key partners, key activities, key resources, channels, customer relationships, cost structure, revenue streams, sticky note]
contexts: []
order: 210
---

**Business model canvas** is a built-in Kit for describing how an organisation creates, delivers and captures value, on the familiar one-page canvas of nine blocks.

## What it is

The canvas has nine **blocks**, each a container. Inside them you place **items**, like sticky notes: a partner, an activity, a value proposition, a customer segment, a cost and so on. Each item says how well it is tested (assumption, tested or proven). Revenue streams and costs can have an annual amount, so the canvas adds up the revenue, the cost and the margin. **Links** connect items that belong together, such as a value proposition and the segment it is for.

| Class | What it stands for |
| --- | --- |
| **Canvas block** | One of the nine blocks: Key partners, Key activities, Key resources, Value propositions, Customer relationships, Channels, Customer segments, Cost structure, Revenue streams. A container for its items. |
| **Canvas item** | A note in a block, with details, evidence and an optional annual amount. |

| Relation class | From | To | Attributes |
| --- | --- | --- | --- |
| **Links to** | Canvas item | Canvas item | **Label**, shown on the line |

## Where to find it

In the **Business and strategy** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Bike repair subscription" is `kits/business-model-canvas/bike-repair.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Business model canvas**. The quickest start is to import the sample and change it ([[import-export]]); its blocks are already laid out.
3. To draw a block yourself, place a **Canvas block**, give it a name and choose its **Block**. Its panel shows the question the block answers.
4. Place **items** inside the blocks ([[containers-swimlanes]]). Set **Evidence** as your work tests them.
5. Give revenue streams and costs an **Annual amount**.
6. Connect each value proposition to the segments it serves with **Links to**, and add other links that explain the model.

## Every option explained

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Question** | Canvas block | The question the block answers, such as "For whom do we create value?". |
| **Items**, **Total** | Canvas block | How many items sit inside, and their annual amounts added up. |
| **Heading** | Canvas block | The name, with the total for blocks with amounts, such as "Revenue streams, 820000 a year". |
| **Block** | Canvas item | The block it sits in. |
| **Revenue**, **Cost** | Canvas item | Its annual amount when it is a revenue stream or a cost. |
| **Note** | Canvas item | The annual amount, or the evidence, shown under the name. |
| **Total revenue**, **Total cost**, **Margin** | The model | The sums over all items, and revenue minus cost. |

The fill of an item shows its evidence: yellow for an assumption, blue when tested, green when proven.

### Checks in the Problems panel

All are warnings ([[constraints]]):

- an item outside any block;
- an annual amount on an item that is not a revenue stream or a cost;
- a value proposition or a customer segment that is not linked to any other item;
- more than nine blocks in one model.

### Model type

**Business model canvas** holds both classes; blocks accept only items ([[model-types]]).

## Examples

In the sample, a city bike service sells repair subscriptions. Its value propositions are "Bike fixed where it is parked" (proven), "One price a month" (tested) and "Fleet always ready" (still an assumption). Revenue is 820,000 a year and cost 630,000, so the margin is 190,000.

The sample shows one warning on purpose: the segment **Students** is not linked to any value proposition yet. Either find what the service offers them, or drop the segment.

## Good to know

- **Keep items short.** Put the reasoning in **Details**, where the panel shows it.
- **Test the riskiest assumptions first.** The yellow items show what is still a guess.
- To turn a canvas into a plan, use the [[okrs-goals]] Kit for goals and key results, or [[data-ai-strategy]] for initiatives and benefits.

## Related

[[built-in-kits]] · [[value-streams-journeys]] · [[containers-swimlanes]] · [[computed-values]]
