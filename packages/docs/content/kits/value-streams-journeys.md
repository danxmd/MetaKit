---
id: value-streams-journeys
title: Value streams and customer journeys
category: kits
summary: A built-in Kit for value streams and customer journey maps, with stages, touchpoints scored by emotion, channels, pain points, opportunities and metrics.
keywords: [value stream, customer journey, journey map, stage, touchpoint, channel, pain point, opportunity, emotion, mood, persona, customer experience, service design]
contexts: []
order: 220
---

**Value streams and customer journeys** is a built-in Kit for mapping how a customer moves through the stages of getting value from an organisation, how each step feels, what hurts, and what could make it better.

## What it is

A **value stream** includes **stages**, each a container laid out from left to right. Inside a stage sit the **touchpoints** where the customer meets the organisation, each through a channel and with an **emotion** from -2 to +2. **Then** connectors show the order of the steps. **Pain points** hurt touchpoints, **opportunities** address pain points, and **metrics** measure stages.

| Class | What it stands for |
| --- | --- |
| **Value stream** | The stages through which value reaches a customer, with the customer and the value proposition. |
| **Stage** | A stage of the journey, with its order and the customer's goal. A container for touchpoints, pain points and opportunities. |
| **Touchpoint** | A step where the customer meets the organisation, with a channel, an emotion and an owner. |
| **Pain point** | Something that annoys or blocks the customer, with its severity and cause. |
| **Opportunity** | An idea to remove a pain point, rated on value and effort from 1 to 5. |
| **Metric** | A number with a target, such as days to installation. |

Value stream and Metric (the catalog's KPI) come from the class catalog ([[class-catalog]]).

| Relation class | From | To |
| --- | --- | --- |
| **Includes** | Value stream | Stage |
| **Then** | Touchpoint | Touchpoint |
| **Hurts** | Pain point | Touchpoint |
| **Addresses** | Opportunity | Pain point, Touchpoint |
| **Measures** | Metric | Stage, Touchpoint, Value stream |

## Where to find it

In the **Business and strategy** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Getting broadband at home" is `kits/value-streams-journeys/broadband-journey.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Customer journey map**, or import the sample ([[import-export]]). Fill in the **Persona** and **Scenario** of the model.
3. Place the **value stream** at the top and the **stages** below it from left to right, each with its **Order**. Connect the value stream to them with **Includes**.
4. Place the **touchpoints** inside their stages ([[containers-swimlanes]]), choose a **Channel** and an **Emotion**, and connect them in order with **Then**.
5. Add **pain points** under the touchpoints they **hurt**, and **opportunities** that **address** them.
6. Add **metrics** under the stages they measure.
7. Open the Problems panel ([[problems-panel]]) to find severe pain points nobody addresses.

## Every option explained

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Feeling** | Touchpoint | Happy above 0, Unhappy below 0, otherwise Neutral. The fill shows it: green, yellow or red. |
| **Summary** | Touchpoint | The channel and the emotion, such as "Email, -2". |
| **Average emotion** | Stage | The average emotion of its touchpoints. |
| **Mood** | Stage | Positive from 0.5, Negative from -0.5 down, otherwise Neutral. The fill of the stage shows it. |
| **Pain points** | Stage, Touchpoint, the model | How many pain points sit inside, hurt it, or exist. |
| **Heading** | Stage | Such as "3. Wait for installation, mood -1". |
| **Priority** | Opportunity | Value × (6 − effort), from 1 to 25: high value and low effort come first. |
| **On track**, **Reading** | Metric | Whether the current value meets the target in its direction, and a line such as "18 days, target 7". |
| **Stages** | Value stream | How many stages it includes. |
| **Average emotion** | The model | Over all touchpoints. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a severe pain point that no opportunity addresses;
- a pain point that hurts no touchpoint;
- a touchpoint outside a stage or without a channel;
- an opportunity that addresses nothing;
- a metric that measures nothing.

### Model type and views

**Customer journey map** holds all classes; stages accept touchpoints, pain points and opportunities. Its views are **Journey** and **Value stream** ([[model-types]]).

## Examples

In the sample, Sam is moving into a new flat and needs broadband. The journey has five stages. "Wait for installation" has a mood of -1: the first free installation date is three weeks away, a severe pain point that the opportunity "Let customers pick a slot online" addresses. The metric "Days from order to installation" is 18 against a target of 7, so it is red.

The sample shows one warning on purpose: the severe pain point "Waits at home all day" has no opportunity yet.

## Good to know

- **Emotion is the customer's, not yours.** Base it on interviews or survey answers where you can.
- **Leave room between stages.** When the stages stand a little apart, the **Then** connectors run between them instead of across them.
- Use the [[capability-map]] Kit to find which capabilities support each stage, and [[stakeholder-org-map]] for the teams that own the touchpoints.

## Related

[[built-in-kits]] · [[business-model-canvas]] · [[kpi-metric-tree]] · [[containers-swimlanes]] · [[computed-values]]
