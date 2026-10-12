---
id: enterprise-architecture
title: Enterprise architecture
category: kits
summary: A built-in Kit for describing an organisation in three layers, business, application and technology, and how their elements serve, realise and run each other.
keywords: [enterprise architecture, business layer, application layer, technology layer, business actor, business role, business process, business service, application component, application service, application interface, data object, node, system software, network, serves, realises, assigned to]
contexts: []
order: 300
---

**Enterprise architecture** is a built-in Kit for drawing how an organisation works, which applications support that work and what technology they run on. Its notation is MetaKit's own: one colour per layer and plain names for the relations, so it reads without training in any standard.

## What it is

The model has three layers, each a **Layer** lane:

- **Business** (green): who does what, and what the organisation offers.
- **Application** (blue): the software that supports the business, and its data.
- **Technology** (teal): what the software runs on.

Lines between the layers show how each layer serves the one above, so you can follow a business process down to the server it depends on.

| Class | Layer | What it stands for |
| --- | --- | --- |
| **Layer** | All | A lane that gathers one layer. Its band shows the layer's colour. |
| **Business actor** | Business | A person, team, organisation unit or outside party. |
| **Business role** | Business | A part that actors play, such as order picker. From the class catalog ([[class-catalog]]). |
| **Business process** | Business | A repeatable set of activities with an owner. From the class catalog. |
| **Business service** | Business | What the business offers to customers or other parts of the organisation. |
| **Application component** | Application | A piece of software with an owner, a life cycle and a hosting. |
| **Application interface** | Application | A screen or API through which an application is reached. From the class catalog (Interface). |
| **Application service** | Application | A function that an application offers. |
| **Data object** | Application | Data that applications use, with its classification. |
| **Node** | Technology | A server, virtual machine, container platform, cloud service or device. |
| **System software** | Technology | An operating system, database, middleware or runtime. |
| **Network** | Technology | A local network, wide area network, the internet or a private link. |

| Relation class | Meaning | Example |
| --- | --- | --- |
| **Serves** | Offers its function to the element it points to. | Order handling serves Take order. |
| **Realises** | Makes a service or interface real. | Order management realises Order handling. |
| **Assigned to** | Does the work, or runs it. | A node runs a component; an actor fills a role; a role performs a process. |
| **Accesses** | Reads or writes a data object; **Access** is shown on the line. | Order management writes Order. |
| **Flows to** | Something passes on; **What** is shown on the line. | Orders to pick flow to the warehouse system. |
| **Triggers** | Starts the next process. | Take order triggers Pick and pack. |
| **Connected to** | Links nodes and networks. | Warehouse server is connected to the warehouse network. |

## Where to find it

In the **Architecture** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Online ordering" is `kits/enterprise-architecture/online-ordering.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Enterprise architecture**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Draw three **Layers**, one under the other, and set their **Kind** to Business, Application and Technology ([[containers-swimlanes]]).
4. In the business layer, place the services, processes, roles and actors. Connect processes with **Triggers**, and roles to processes with **Assigned to**.
5. In the application layer, place the components, their services and interfaces, and the data objects. Connect components to the services they offer with **Realises**, services to processes with **Serves**, and components to data with **Accesses**.
6. In the technology layer, place the nodes, system software and networks. Connect nodes to the components they run with **Assigned to**.
7. Pick a palette view such as **Application layer** to see only the classes of one layer while you draw ([[palette]]).
8. Open the Problems panel ([[problems-panel]]) to find loose ends.

## Every option explained

### Attributes worth knowing

| Attribute | Of | Values |
| --- | --- | --- |
| **Kind** | Layer | Business, Application, Technology. It sets the colour of the band. |
| **Lifecycle** | Application component | Plan, Invest, Tolerate, Migrate, Retire. Shown under the name. |
| **Hosting** | Application component | On-premises, Cloud, Software as a service. |
| **Classification** | Data object | Public, Internal, Confidential, Restricted. |
| **Kind** | Node, System software, Network | What sort of node, software or network it is. |

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Supports** | Application component | How many elements it serves or realises. |
| **Used by** | Data object | How many processes, components and services access it. |
| **Runs** | Node | How many components and system software it runs. |
| **Served by** | Business process | How many services, components and interfaces serve it. |
| **Applications**, **Processes** | The model | How many components and processes the model holds. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a business service and an application service are realised by something;
- an application component that is not software as a service runs on a node or system software;
- an application component to be retired no longer serves or realises anything;
- a data object is used by something.

### Model type and views

**Enterprise architecture** holds all classes. A layer accepts every class except another layer ([[model-types]]). The palette views **Business layer**, **Application layer** and **Technology layer** each offer one layer's classes and relation classes, together with **Layer**.

## Examples

The sample shows online ordering at a regional food wholesaler. The customer triggers **Take order**, which realises the business service **Online ordering** and is served by the application service **Order handling**. **Order management** realises that service and the **Order API**, writes the **Order** data object and runs on **Cloud hosting** with the **Order database**.

The sample shows one warning on purpose: the **Old warehouse system** is marked **Retire** but still serves **Pick and pack**. Before it can be switched off, picking needs another application.

## Good to know

- **Draw one question per model.** A model of everything is hard to read. Make one model per area, such as ordering or finance, and use views while drawing.
- **The layers are lanes, not walls.** Lines cross them freely, and a lane grows when you place something at its edge.
- **The notation is not a copy of a standard.** If your organisation uses a formal notation, copy this Kit and adapt the looks and names in Build mode ([[built-in-kits]]).
- Use the [[software-c4]] Kit to go inside one application, and the [[threat-model]] Kit to look at its security.

## Related

[[built-in-kits]] · [[software-c4]] · [[threat-model]] · [[containers-swimlanes]] · [[constraints]]
