## ADDED Requirements

### Requirement: Documentation topics

The system SHALL provide documentation as topics grouped in categories, each with a title, a summary, keywords and optional page contexts, written in Markdown and shipped with the app.

#### Scenario: Every page has a topic
- **WHEN** the app reports a page context
- **THEN** at least one topic lists that context

#### Scenario: Links resolve
- **WHEN** a topic links to another topic with `[[id]]`
- **THEN** the id exists, and the test run fails otherwise

### Requirement: Help side bar

The system SHALL offer a Help side bar on every page of the workspace that opens at the topic of the current page.

#### Scenario: Open at the current page
- **WHEN** the person opens Help while in the Classes section of Build mode
- **THEN** the side bar shows the Classes topic and the page stays usable beside it

#### Scenario: Follow a keyword
- **WHEN** the person clicks a linked keyword
- **THEN** the side bar shows that topic and Back returns to the previous one

### Requirement: Documentation section

The system SHALL provide a Documentation area with a topic tree by category, search, and a Tutorials category that can be filled later without code changes.

#### Scenario: Search
- **WHEN** the person types a word
- **THEN** topics whose title, keywords, summary or text contain it are listed, best match first
