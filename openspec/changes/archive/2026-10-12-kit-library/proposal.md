# Proposal

## Why

MetaKit ships six built-in Kits. People who model for a living, and data and AI consultants above all, need ready Kits for every part of their client work: strategy, data, AI, governance, delivery, architecture and change. They also need a much richer catalog of concepts, so that a Kit of their own can be put together in minutes.

## What Changes

**28 new built-in Kits**, bringing the total to 34. Each Kit has:
- classes and relation classes with simple looks
- panels, constraints and computed values where they help
- a sample model
- one short help topic

**Data and AI consulting (the focus)**

| Kit | What it models |
| --- | --- |
| **Data and AI strategy** | Vision, goals, use cases, capabilities, initiatives, a roadmap and value |
| **Data and AI maturity assessment** | Capability areas scored now and as a target, the gaps, and the actions to close them |
| **Data mesh and data products** | Domains, data products, input and output ports, data contracts, SLAs and the platform |
| **Data modelling** | Conceptual, logical and physical data models with entities, attributes, keys and relationships |
| **Data pipelines and lineage** | Sources, jobs, transformations, schedules and lineage from field to report |
| **Data quality management** | Rules, dimensions, checks, results, issues and owners |
| **Master data management** | Domains, golden records, sources, match and merge rules, and stewardship |
| **Analytics and BI landscape** | Reports, dashboards, semantic models, metrics and audiences |
| **KPI and metric tree** | Driver trees from the business outcome down to operational metrics, with targets and formulas |
| **ML lifecycle (MLOps)** | Experiments, training runs, models, evaluations, deployments, monitoring and approvals |
| **Generative AI solution** | LLMs, prompts, retrieval (RAG), knowledge bases, tools, agents, guardrails and evaluations |
| **AI risk and compliance** | AI systems, risk tiers, controls, assessments, incidents and the obligations they meet |
| **Privacy and records of processing** | Processing activities, data categories, purposes, legal bases, recipients, transfers and retention |
| **Cloud data migration** | Source systems, migration waves, target services, dependencies, cut-over and status |

**Business and strategy**

| Kit | What it models |
| --- | --- |
| **Business capability map** | Levels, maturity, heat by importance, and the applications that support each capability |
| **Business model canvas** | The nine blocks as containers, with their notes |
| **Value streams and customer journeys** | Stages, touchpoints, pain points, emotions and opportunities |
| **Stakeholder and organisation map** | Org units, roles, people, interest and influence, and RACI |
| **OKRs and goals** | Objectives, key results, initiatives and progress |

**Delivery**

| Kit | What it models |
| --- | --- |
| **Project delivery and RAID** | Workstreams, milestones, deliverables, risks, assumptions, issues, dependencies and decisions |
| **Requirements and user stories** | Epics, features, stories, acceptance criteria and traceability to goals |
| **Decision tables (DMN-style)** | Decisions, inputs, rules and knowledge sources |

**Architecture and engineering**

| Kit | What it models |
| --- | --- |
| **Enterprise architecture** | Business, application and technology layers with their relationships |
| **Software architecture (C4-style)** | People, systems, containers and components |
| **Event storming** | Events, commands, actors, aggregates, policies and read models |
| **Security threat model** | Data flows, trust boundaries, assets, threats and mitigations |

**General**

| Kit | What it models |
| --- | --- |
| **Mind map and concept map** | Topics, ideas and labelled links |
| **Org chart** | Units, positions and people, with reporting lines |

All wording is generic. No company, client or vendor is named; technology fields are free text.

**A much larger concept catalog**
- From 64 to about 250 concepts, and from 19 to about 60 relation classes, in 16 topic tabs.
- New tabs:
  - Generative AI
  - MLOps
  - Data mesh
  - Data quality and MDM
  - Analytics and BI
  - Privacy and compliance
  - Strategy and value
  - Enterprise architecture
  - Software and cloud
  - Security
  - People and organisation
  - Customer and marketing
  - Finance and operations
- Every concept follows the existing catalog rules: attributes, help text, a simple look and formulas where useful, and relation classes that come along only when they fit the picks.

**Finding Kits**
- The Built-in Kits section groups its cards by domain:
  - Data and AI
  - Business and strategy
  - Delivery
  - Architecture
  - General
- It gets a search box, because 34 cards in one long list are hard to scan.

## Capabilities

### New Capabilities

- `kit-library`

## Impact

- **Order:** this starts after the Kit rename's PR 3, so the new Kits are written as `kits/<name>/kit.json` with `kit_` ids from the start.
- **Download size:** each Kit loads only when used. The catalog is already a lazy chunk; growing it to about 250 concepts keeps it at roughly 40 KB compressed, still outside the start-up download.
- **No format changes.**
- **Delivery:** about eight PRs, one per domain group of three or four Kits, plus one for the catalog. Each PR is mostly data, plus a test per Kit.
