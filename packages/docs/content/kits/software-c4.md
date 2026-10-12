---
id: software-c4
title: Software architecture (C4-style)
category: kits
summary: A built-in Kit for software architecture at three levels in the style of the C4 approach, system context, containers and components, with what each relationship is for and how it talks.
keywords: [c4, software architecture, system context, container diagram, component diagram, person, software system, container, component, external system, system boundary, container boundary, uses, technology]
contexts: []
order: 310
---

**Software architecture (C4-style)** is a built-in Kit for drawing a software system at the levels of the C4 approach: first the system in its setting, then the parts it is built from, then the inside of one part. Each level is a model type of its own.

## What it is

- **System context**: one software system with the people who use it and the other systems it works with.
- **Containers**: the inside of one system. A container is something that runs or stores data on its own: a web application, a mobile app, an API, a database, a queue or a background job.
- **Components**: the inside of one container. A component is a group of related code behind a clear interface.

On the container and component levels a **boundary** shows the edge of the system or container you are looking inside. Boundaries are lanes, so the lines between the parts inside them stay visible.

| Class | Level | What it stands for |
| --- | --- | --- |
| **Person** | All | A user, **Internal** (blue) or **External** (grey). |
| **Software system** | All | Software that delivers value to its users, owned by one team or organisation. Shown with "[Software system]". |
| **External system** | All | A system outside the scope of the model, such as a payment service. Grey. |
| **System boundary** | Containers | The edge of one software system. Place its containers inside it. |
| **Container** | Containers, Components | Something that runs or stores data on its own, with its **Kind** and **Technology**, shown as "[API: Java, REST]". |
| **Container boundary** | Components | The edge of one container. Place its components inside it. |
| **Component** | Components | A group of related code inside a container, with its technology. |

There is one relation class, **Uses**, with a **Description** (what it is for, such as "Makes bookings") and a **Technology** (how it talks, such as "JSON/HTTPS"). Both are shown on the line, as "Makes bookings [JSON/HTTPS]".

## Where to find it

In the **Architecture** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Ticket booking: containers" is `kits/software-c4/ticket-booking.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Start with a model of the type **System context**. Place your **Software system** in the middle, the **People** who use it and the **External systems** it talks to around it, and connect them with **Uses**.
3. Make a second model of the type **Containers**, or import the sample with **Import / Export** on the Models page ([[import-export]]). Draw a **System boundary** and place the **Containers** inside it ([[containers-swimlanes]]). Keep the people and external systems outside.
4. For each container set the **Kind** and the **Technology** ([[attribute-panel]]).
5. Connect everything with **Uses** and fill in the **Description** and **Technology** of each line.
6. For a container worth a closer look, make a model of the type **Components** with a **Container boundary** and the **Components** inside it.
7. Open the Problems panel ([[problems-panel]]) to find lines without a description.

## Every option explained

### Model types

| Model type | Classes | Boundary |
| --- | --- | --- |
| **System context** | Person, Software system, External system | None |
| **Containers** | The above, System boundary, Container | A system boundary accepts containers. |
| **Components** | Person, Software system, External system, Container, Container boundary, Component | A container boundary accepts components. |

### Attributes worth knowing

| Attribute | Of | Values |
| --- | --- | --- |
| **Location** | Person | Internal or External; it sets the colour. |
| **Kind** | Container | Web application, Mobile app, Desktop app, API, Database, Message queue, File store, Background job. |
| **Technology** | Container, Component, Uses | Free text, such as "Relational database" or "JSON/HTTPS". |

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Tag** | Software system, External system, Container, Component | The kind and technology in square brackets, shown under the name. |
| **Parts** | System boundary, Container boundary | How many containers or components it holds. |
| **Label** | Uses | The description, then the technology in square brackets. |
| **Containers** | Containers model | How many containers the diagram shows. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- every **Uses** line has a description;
- a container says what it is built with;
- a person and an external system have at least one relationship.

## Examples

The sample shows the containers of the ticketing system of a regional theatre group. Theatre visitors book in the **Web shop** and box office staff sell tickets in the **Box office app**. Both call the **Booking API**, which reads and writes the **Booking database**, takes payments through the **Payment provider** and queues confirmations for the **Email worker**, which sends them through the **Email service**.

The sample shows one warning on purpose: the line from **Email service** to **Theatre visitor** has no description. A description such as "Sends booking confirmations to" would fix it.

## Good to know

- **Say what, then how.** "Makes bookings [JSON/HTTPS]" tells a reader more than "uses".
- **A container is not a container image.** In this approach, a container is any separately running or storing part, whatever technology it uses.
- **Keep one model per level.** Draw the context once, then one container model per system and one component model per interesting container.
- Use the [[enterprise-architecture]] Kit for the wider landscape and the [[threat-model]] Kit for the security of one system.

## Related

[[built-in-kits]] · [[enterprise-architecture]] · [[threat-model]] · [[event-storming]] · [[model-types]]
