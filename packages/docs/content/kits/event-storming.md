---
id: event-storming
title: Event storming
category: kits
summary: A built-in Kit for event storming, with domain events on a timeline, the commands, actors, aggregates, policies, read models and external systems around them, hotspots for open questions and bounded contexts as lanes.
keywords: [event storming, domain event, command, actor, aggregate, policy, read model, hotspot, bounded context, timeline, sticky notes, domain-driven design]
contexts: []
order: 320
---

**Event storming** is a built-in Kit for the workshop technique of the same name: a group puts the events of a business process on a wall of sticky notes, in time order, and finds out what causes each one. In MetaKit the wall is a model, so it can be kept, shared and refined after the workshop.

## What it is

Each kind of sticky has its own colour, as on a paper wall:

| Class | Colour | What it stands for |
| --- | --- | --- |
| **Domain event** | Orange | Something that happened that experts care about, in the past tense: "Bike reserved". It has a **Step** on the timeline. |
| **Command** | Blue | A request to do something: "Reserve bike". It may be refused. |
| **Actor** | Yellow person | Who issues a command, such as a rider. |
| **Aggregate** | Pale yellow | The part of the model that receives commands, keeps its **Rules** and raises events, such as a rental. |
| **Policy** | Lilac | A reaction: "whenever this happens, do that". **Automatic** or **Manual**. |
| **Read model** | Green | What someone needs to see to decide, such as free bikes near me. |
| **External system** | Pink | A system outside the domain, such as a payment provider. |
| **Hotspot** | Red diamond | A question, risk or disagreement to come back to. Grey once **Answered**. |
| **Bounded context** | Grey band | A part of the domain with its own language and team. A lane for its stickies. |

| Relation class | From | To |
| --- | --- | --- |
| **Issues** | Actor, Policy, External system | Command |
| **Handled by** | Command | Aggregate, External system |
| **Raises** | Aggregate, Command, External system | Domain event |
| **Triggers** | Domain event | Policy |
| **Updates** | Domain event | Read model |
| **Informs** | Read model | Actor |
| **Then** | Domain event | Domain event |
| **About** | Hotspot | Any other sticky |

## Where to find it

In the **Architecture** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Bike rental" is `kits/event-storming/bike-rental.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Event storm**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Start with the palette view **Big picture** ([[palette]]): place the **Domain events** from left to right in the order they happen, and give each a **Step**. Add a **Hotspot** wherever the group is unsure.
4. Switch back to all classes. Before each event, place the **Command** that causes it and the **Actor** or **Policy** that issues it. Connect them with **Issues** and **Raises**.
5. Add the **Aggregates** that handle commands, the **Read models** people decide with and the **External systems** involved.
6. When the language changes, start a new **Bounded context** lane and move the stickies into it ([[containers-swimlanes]]).
7. Open the Problems panel ([[problems-panel]]) to find commands and policies that lead nowhere.

## Every option explained

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Step label** | Domain event | "Step 3", shown under the name. |
| **Context** | Domain event | The name of the bounded context it sits in. |
| **Stickies** | Bounded context | How many stickies sit in it. |
| **Events**, **Hotspots** | The model | How many domain events and hotspots the storm found. |

### Checks in the Problems panel

All are warnings ([[constraints]], [[model-types]]):

- a command raises an event, or is handled by an aggregate or external system;
- a policy issues a command;
- an event linked with **Then** comes before the next one: its **Step** is lower;
- the model has at least one domain event.

### Model type and views

**Event storm** holds all classes; a bounded context accepts every sticky. The palette view **Big picture** offers only bounded contexts, events, actors, external systems and hotspots, with **Then** and **About**, for the first round of a workshop.

## Examples

The sample storms a city bike rental scheme. In the **Rental** context a rider reserves a bike, which the **Rental** aggregate handles; **Bike reserved** (step 1) updates the read model **Free bikes near me**. The rider then unlocks the bike (step 2) and ends the ride (step 3). In the **Billing** context the policy **When a ride ends, charge it** issues **Charge ride**; the **Account** raises **Ride charged** (step 4), and the **Payment provider** may raise **Payment failed** (step 5). A hotspot asks what happens when a ride ends away from a station.

The sample shows one warning on purpose: the command **Report damage** leads to nothing yet. The group has not decided what it causes.

## Good to know

- **Events first.** Find the events before the commands; they are what experts remember.
- **Copy actors freely.** Place the same actor before every command it issues, as on a paper wall, instead of drawing long lines back to one sticky.
- **Hotspots are not failures.** They are the questions worth the workshop; answer them later and set their status to **Answered**.
- Use the [[software-c4]] Kit to design the systems that come out of the storm.

## Related

[[built-in-kits]] · [[software-c4]] · [[decision-tables]] · [[containers-swimlanes]] · [[constraints]]
