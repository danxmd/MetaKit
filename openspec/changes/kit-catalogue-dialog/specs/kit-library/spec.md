# Spec Delta

## MODIFIED Requirements

### Requirement: Built-in Kits by domain
MetaKit SHALL ship the built-in Kits listed in the `kit-library` proposal, grouped by domain in the Kit catalogue (see `kit-catalogue`), with a search box over their names and descriptions. The Kits page SHALL show the domains with their counts and open the catalogue.

#### Scenario: Find a Kit
- **WHEN** "lineage" is typed into the catalogue search
- **THEN** "Data pipelines and lineage" and "Data and AI architecture" are listed, and no other Kit is

#### Scenario: Domains on the Kits page
- **WHEN** the Kits page is shown
- **THEN** the Built-in band lists the five domains with the number of Kits in each, and no Kit cards
