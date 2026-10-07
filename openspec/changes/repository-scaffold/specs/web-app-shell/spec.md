# Spec Delta

## Purpose

Defines how the static MetaKit web app starts and what a visitor sees before real features exist, including a clear message on browsers that cannot open local folders.

## ADDED Requirements

### Requirement: Placeholder page
The web app SHALL show a page that names the product as MetaKit and states that the app is under construction.

#### Scenario: Chrome or Edge visitor
- **WHEN** a visitor opens the app in a browser that supports the File System Access API
- **THEN** the page shows the MetaKit name and the placeholder text
- **AND** no browser-support warning is shown

### Requirement: Unsupported browser message
The web app SHALL load without errors in browsers that lack `showDirectoryPicker` and SHALL tell the visitor that local folders need Chrome or Edge.

#### Scenario: Firefox or Safari visitor
- **WHEN** a visitor opens the app in a browser without `showDirectoryPicker`
- **THEN** the page still loads and shows the placeholder
- **AND** a visible message says that local folders need Chrome or Edge on desktop

### Requirement: Static delivery
The web app SHALL build to static files that work when served from a sub-path such as `/MetaKit/`, with no server-side code.

#### Scenario: Production build served from a sub-path
- **WHEN** the production build output is served under `/MetaKit/`
- **THEN** the page, scripts and styles load without 404 errors
