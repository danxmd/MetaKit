---
id: threat-model
title: Security threat model
category: kits
summary: A built-in Kit for threat modelling, with a data flow diagram inside trust boundaries, the assets worth protecting, threats sorted by STRIDE category and scored by likelihood and impact, and their mitigations.
keywords: [threat model, threat modelling, security, data flow diagram, trust boundary, process, data store, external entity, asset, threat, stride, mitigation, spoofing, tampering, encryption]
contexts: []
order: 330
---

**Security threat model** is a built-in Kit for finding out what could go wrong with the security of a system and what is done about it. You draw how data moves, mark where trust changes, list the threats and connect each one to its mitigations.

## What it is

The first part is a **data flow diagram**: **Processes** (software that handles data), **Data stores** and **External entities** (people or systems outside the scope), joined by **Data flows**. **Trust boundaries** are lanes around the parts that trust each other. A flow that crosses a boundary is drawn red until it is both encrypted and authenticated.

The second part lists the **Assets** worth protecting, the **Threats** against the system and the **Mitigations** that work against them. Each threat has one of the six STRIDE categories and a score of likelihood times impact.

| Class | What it stands for |
| --- | --- |
| **Trust boundary** | A dashed red lane around everything that trusts each other to the same degree, such as a company network. |
| **Process** | Software that handles data, with its technology and the account it runs as. An oval. |
| **Data store** | A database, file store or queue, with its classification. |
| **External entity** | A person, system or organisation outside the scope. |
| **Asset** | Something worth protecting, such as personal data. A yellow hexagon. |
| **Threat** | Something that could go wrong, with its STRIDE **Category**, **Likelihood** and **Impact** (1 to 5), **Status** and **Owner**. Coloured by rating. |
| **Mitigation** | A measure against a threat (**Prevent**, **Detect** or **Respond**), coloured by its status: Planned, In progress, In place or Verified. |

| Relation class | From | To | Meaning |
| --- | --- | --- | --- |
| **Data flow** | Process, Data store, External entity | Process, Data store, External entity | Data moves, with **Data**, **Protocol**, **Encrypted** and **Authenticated**. |
| **Threatens** | Threat | Process, Data store, External entity, Asset | The threat puts it at risk. |
| **Mitigates** | Mitigation | Threat | The mitigation works against the threat. |
| **Holds** | Data store, Process | Asset | Keeps or handles the asset. |

## Where to find it

In the **Architecture** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Staff expenses app" is `kits/threat-model/expenses-app.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Threat model**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. With the palette view **Data flows** ([[palette]]), draw a **Trust boundary** and place the processes and data stores inside it ([[containers-swimlanes]]). Keep external entities outside.
4. Connect them with **Data flows**. For each flow fill in **Data** and **Protocol**, and tick **Encrypted** and **Authenticated** where they hold ([[attribute-panel]]). Red flows need attention.
5. Add the **Assets** and connect the stores that hold them with **Holds**.
6. Go through the six STRIDE categories for each element and add a **Threat** for each real danger. Connect it to what it threatens and score it on the **Score** tab.
7. Add **Mitigations** and connect them to the threats with **Mitigates**.
8. Open the Problems panel ([[problems-panel]]) to find unprotected flows and high threats without a mitigation.

## Every option explained

### The STRIDE categories

| Category | The threat is that someone… |
| --- | --- |
| **Spoofing** | pretends to be someone or something else. |
| **Tampering** | changes data or code they should not. |
| **Repudiation** | denies having done something, and nobody can prove it. |
| **Information disclosure** | reads data they should not see. |
| **Denial of service** | makes the system unavailable. |
| **Elevation of privilege** | gains rights they should not have. |

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Score** | Threat | Likelihood times impact, from 1 to 25. |
| **Rating** | Threat | High from 15, Medium from 8, otherwise Low. It colours the threat. |
| **Mitigations** | Threat | How many mitigations work against it. |
| **Crosses a boundary** | Data flow | Yes when its two ends sit in different trust boundaries, or one of them in none. |
| **Unprotected** | Data flow | Yes when it crosses a boundary without being both encrypted and authenticated. It colours the line red. |
| **Label** | Data flow | The data and the protocol, shown on the line. |
| **Threats**, **Mitigations** | The model | How many of each the model lists. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a data flow that crosses a trust boundary is encrypted and authenticated;
- a high threat has a mitigation, unless its status is **Accepted** or **Transferred**;
- a threat threatens something, and a mitigation mitigates something.

### Model type and views

**Threat model** holds all classes. A trust boundary accepts processes, data stores, external entities and other trust boundaries ([[model-types]]). The palette view **Data flows** offers the diagram classes; **Threats** offers assets, threats and mitigations with the elements they point to.

## Examples

The sample models the staff expenses app of a mid-sized retailer. Employees send expense claims to the **Expenses web app** over HTTPS, encrypted and authenticated, so the flow is grey even though it crosses the **Company cloud** boundary. The **Receipt store** is threatened by **Receipts read by other staff** (information disclosure, score 12), with the mitigation **Encrypt the receipt store** still planned.

The sample shows two warnings on purpose:

- the **Payment file** flow from the **Approval service** to the **Bank payment system** leaves the boundary encrypted but not authenticated, and is drawn red;
- the threat **Payment file changed** (tampering, score 15, High) has no mitigation yet.

## Good to know

- **A boundary is about trust, not about machines.** Two services on one server can sit in different boundaries if they trust different callers.
- **Nested boundaries count as different boundaries.** A flow between a lane and a lane inside it crosses a boundary.
- **Accept a risk on purpose.** If a high threat is not worth mitigating, set its status to **Accepted** and write why in its description.
- Use the [[software-c4]] Kit to describe the system first; its containers become the processes and data stores here.

## Related

[[built-in-kits]] · [[software-c4]] · [[enterprise-architecture]] · [[project-raid]] · [[constraints]]
