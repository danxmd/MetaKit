# Spec Delta

## Purpose

Three ready-to-use tool libraries for data and AI project work, shipped as built-in tool libraries.

## ADDED Requirements

### Requirement: Data and AI architecture tool
The sample `data-ai-architecture` SHALL model sources, ingestion, pipelines, stores, datasets, ML models, AI services and consumers in zones, connected by data flows. It SHALL warn when personal data flows into a store that is not approved for it, and offer a command that lists the lineage of the selected object.

#### Scenario: Personal data into an unapproved store
- **WHEN** a data flow with "Contains personal data" on ends at a data store whose "Approved for personal data" is off
- **THEN** the problems list shows a warning on that flow

#### Scenario: Lineage
- **WHEN** a dataset is selected and **Show lineage** is run
- **THEN** a message lists the objects upstream and downstream of it, in flow order

### Requirement: AI use-case portfolio tool
The sample `ai-use-case-portfolio` SHALL score use cases on value, feasibility, data readiness and risk, compute a priority score and a quadrant with formulas, colour use cases by quadrant, and offer a command that ranks them.

#### Scenario: Quadrant
- **WHEN** a use case has Value 5 and Feasibility 4
- **THEN** its Quadrant is "Quick win" and it is drawn in the quick-win colour

### Requirement: Data governance tool
The sample `data-governance` SHALL model domains, data products, assets, people and roles, glossary terms, policies, classifications and quality rules, and SHALL report data products without an owner and restricted assets without a policy.

#### Scenario: Product without owner
- **WHEN** a data product has no incoming "Owns" connector
- **THEN** the problems list reports it

### Requirement: Samples are tested
Each new sample SHALL be valid, every formula in it SHALL parse, its script SHALL type-check, and its sample model SHALL load without errors.

#### Scenario: CI
- **WHEN** `pnpm test` runs
- **THEN** the checks above run for all three new samples
