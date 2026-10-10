# Spec Delta

## Purpose

Built-in Kits for every common modelling need, with a focus on data and AI consulting, and a large catalog of concepts to build Kits from.

## ADDED Requirements

### Requirement: Built-in Kits by domain
MetaKit SHALL ship the built-in Kits listed in the proposal, grouped by domain on the Kits page, with a search box over their names and descriptions.

#### Scenario: Find a Kit
- **WHEN** "lineage" is typed into the built-in search
- **THEN** "Data pipelines and lineage" and "Data and AI architecture" are shown, and the other cards are hidden

### Requirement: Every built-in Kit is complete and valid
Each built-in Kit SHALL be valid, every formula in it SHALL parse, every shape SHALL be a simple look, it SHALL have a sample model that loads without errors, and it SHALL have a help topic.

#### Scenario: CI
- **WHEN** `pnpm test` runs
- **THEN** one test file checks every built-in Kit for validity, formulas, looks, the sample model and the help topic

### Requirement: Neutral wording
Built-in Kits, the catalog and their help topics SHALL NOT name a company, client or vendor product.

#### Scenario: Name check
- **WHEN** the tests run
- **THEN** a check over all built-in Kits and catalog text finds none of the listed company or vendor names

### Requirement: Larger catalog
The catalog SHALL offer about 250 concepts and about 60 relation classes in 16 topics, with the existing rules for adding them (one undo step, existing keys skipped, relation classes only with a fitting pick).

#### Scenario: Add a generative AI set
- **WHEN** Prompt, Knowledge base, Retriever and Foundation model are picked from the Generative AI tab
- **THEN** they and the relation classes between them are added in one step, and the Kit stays valid
