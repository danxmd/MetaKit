# Spec Delta

## Purpose

Click-through tours that explain the important controls of each page, started from a Tutorials tab.

## ADDED Requirements

### Requirement: A tour points at real controls
A guided tour SHALL show one step at a time, highlight the step's control, and place a pop-up next to it with a title, a short text, the step count, Back, Next and End tour. Escape SHALL end the tour.

#### Scenario: Next step
- **WHEN** the "Kits page" tour is on step 2 and Next is chosen
- **THEN** step 3 highlights the "New Kit" button and its pop-up sits beside it without covering it

### Requirement: Tutorials tab
The top bar SHALL offer **Tutorials**, which lists every tour with its length, whether it is done in this browser, and a Start button, and lists the written tutorials below.

#### Scenario: Start a tour
- **WHEN** Start is chosen for "Models page" while the Kits page is shown
- **THEN** the Models page opens and the tour starts at its first step

### Requirement: Preconditions
A tour that needs an open model or Kit SHALL NOT start without one. It SHALL say what is needed and offer to go to the page where one can be opened.

#### Scenario: No model open
- **WHEN** "Modelling a model" is started and no model is open
- **THEN** a message says to open a model first and offers "Go to Models"

### Requirement: Tours stay working
Every step of every tour SHALL find its control. An automated test SHALL walk all tours and fail when a step's anchor is missing.

#### Scenario: CI
- **WHEN** `pnpm test:e2e` runs
- **THEN** each tour is started on a prepared workspace and walked to its last step without a missing anchor

### Requirement: First visit
After a person's first profile is saved, MetaKit SHALL offer the first-steps tour once per browser.

#### Scenario: Not now
- **WHEN** "Not now" is chosen
- **THEN** the offer does not return in this browser, and the tour stays available on the Tutorials page
