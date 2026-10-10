---
id: data-mesh
title: Data mesh and data products
category: kits
summary: A built-in Kit for a data mesh, where domains own data products with input and output ports, data contracts, consumers, a self-serve platform and global policies.
keywords: [data mesh, data product, input port, output port, data contract, service level, sla, freshness, availability, consumer, self-serve platform, platform service, federated governance, policy]
contexts: []
order: 40
---

**Data mesh and data products** is a built-in Kit for describing a data mesh: which domain owns which data products, how data comes in and goes out, what each product promises its consumers, and what the shared platform and the global policies take care of.

## What it is

In a data mesh, each business domain shares its data as **data products**. A product takes data in through **input ports** and shares it through **output ports**. A **data contract** on an output port says what consumers can rely on: the schema, the service level and how changes are announced. A **self-serve platform** gives every domain the same services, and global **policies** apply to every product, often enforced by the platform.

| Class | What it stands for |
| --- | --- |
| **Data domain** | An area of the business that owns its data, such as sales or customer. A container for its products, ports and contracts. From the class catalog ([[class-catalog]]). |
| **Data product** | Data packaged for others, with an owner, a type (source-aligned, aggregate or consumer-aligned), a status, a classification and a version. A hexagon whose fill shows the status. From the class catalog. |
| **Input port** | Where a product takes data in, with its mechanism (batch, streaming, API, change data capture or files). |
| **Output port** | Where a product shares its data, with its interface (table, files, API, event stream or query endpoint) and its address. |
| **Data contract** | What the owner promises on an output port: version, status, schema, freshness, availability, quality expectations and notice of changes. A document whose fill shows the status. |
| **Consumer** | A team, application, report, ML model or partner that uses the data. |
| **Source system** | A system where data is first created. From the class catalog. |
| **Self-serve platform** | The shared data platform. A container for its services. |
| **Platform service** | One service of the platform, such as storage, pipelines, the data catalog or access control. Technology is free text. |
| **Policy** | A rule every product must follow, global or for one domain. From the class catalog. |

| Relation class | From | To |
| --- | --- | --- |
| **Feeds** | Input port | Data product |
| **Publishes** | Data product | Output port |
| **Flows to** | Source system, Output port | Input port, Consumer |
| **Has contract** | Output port | Data contract |
| **Built on** | Data product | Platform service |
| **Enforces** | Platform service | Policy |
| **Governed by** | Data product | Policy |

So data runs from left to right: source system, input port, data product, output port, and on to a consumer or to the input port of another product.

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Retail data mesh" is `kits/data-mesh/retail-data-mesh.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Data mesh**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Draw one **Data domain** per business area.
4. Inside each domain place its **Data products**. Fill in the **Owner**, the **Type** and the **Status**.
5. Give each product its **Input ports** (connect each to the product with **Feeds**) and its **Output ports** (connect the product to each with **Publishes**).
6. Place a **Data contract** next to each output port and connect them with **Has contract**. Fill in the version and at least a freshness or an availability.
7. Connect the **Source systems** to the input ports, and the output ports to **Consumers** or to input ports of other products, with **Flows to**.
8. Add the **Self-serve platform** with its **Platform services**, the **Policies**, and the **Built on**, **Enforces** and **Governed by** connectors you need.
9. Open the Problems panel ([[problems-panel]]) to find products without an owner or a contract.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Data product | **Input ports**, **Output ports** | How many input ports feed it and how many output ports it publishes through. |
| Data product | **Consumers** | The consumers of all its output ports added up. |
| Data product | **Contracts** | The contracts of all its output ports added up. |
| Output port | **Consumers** | How many consumers and input ports read from it. |
| Output port | **Contracts**, **Contract version** | How many contracts cover it, and their version. |
| Data contract | **Version label** | "Version 2.1.0", shown under the name. |
| Data contract | **Has service level** | Yes when it gives a freshness or an availability. |
| Platform service | **Used by** | How many data products are built on it. |
| Policy | **Enforced by** | The platform services that enforce it. |
| The model | **Data products**, **Data contracts** | How many of each the model holds. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a data product has an owner;
- a data product has at least one data contract on its output ports;
- a data contract has a service level: a freshness or an availability;
- a data contract version has the form major.minor.patch, such as 2.1.0;
- an input port feeds a data product.

### Model type and views

**Data mesh** holds all classes. A data domain accepts data products, input and output ports and data contracts; the self-serve platform accepts platform services ([[containers-swimlanes]]). Its palette views are **Products and ports** and **Platform and governance** ([[model-types]]).

### Panels

A data product shows **Product** and **Ports and use** tabs; a data contract **Contract**, **Service level** and **Schema and quality** ([[panel-layout]]).

## Examples

The sample is the data mesh of a fashion retailer with four domains. **Orders** in the Sales domain takes store sales and web orders in, and shares an orders table under the **Orders contract** (version 2.1.0, updated by 06:00 every day, 99.5% available). Three readers use that table: Finance reporting and the input ports of the Customer and Marketing domains, so **Orders** has 3 consumers.

The sample shows one warning on purpose: **Stock levels**, still in development, has no data contract yet. Add a contract to its output port **Stock events** and the warning goes away.

## Good to know

- **Domains and products are see-through.** Containers have no fill, so the lines between the ports and products inside them stay visible.
- **One contract per output port** is the usual pattern. A product with several output ports can have a different contract, and version, on each.
- **Global policies need no lines.** A global policy applies to every product. Draw **Governed by** only where you want to show that a product must follow it.
- For ownership, stewardship and glossary terms in more depth, see the Data governance tutorial ([[data-governance]]).

## Related

[[built-in-kits]] · [[data-governance]] · [[data-ai-architecture]] · [[class-catalog]] · [[computed-values]] · [[constraints]]
