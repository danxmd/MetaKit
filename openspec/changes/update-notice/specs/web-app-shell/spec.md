# Spec Delta

## ADDED Requirements

### Requirement: App version
The web app SHALL carry the version from `apps/web/package.json`, put into the build at build time, and SHALL show it in the footer of the Start, Models and Kits pages.

#### Scenario: Footer
- **WHEN** the Start page is shown by a build of version 0.1.0
- **THEN** the footer reads "MetaKit 0.1.0 is free and open source."

### Requirement: Update notice
A copy of the app that is not served from GitHub Pages SHALL ask GitHub for the latest release of `danxmd/MetaKit` when it opens, at most once a day, and SHALL show a notice when that release is newer than its own version. The notice SHALL have `role="status"`, name both versions, say how to update, link to the release page in a new tab with `rel="noopener"`, and offer **Dismiss**. The notice SHALL be shown on the Start page and under the top bar once a workspace is open.

#### Scenario: Newer release
- **WHEN** the app of version 0.1.0 opens and the latest release is tagged `v0.2.0`
- **THEN** a notice says "MetaKit 0.2.0 is available (you have 0.1.0)." with a link to the release page

#### Scenario: Same or older release
- **WHEN** the latest release is the app's own version or an older one
- **THEN** no notice is shown

#### Scenario: Dismiss
- **WHEN** the person chooses **Dismiss** and reloads the app
- **THEN** the notice stays hidden for that version
- **AND** it shows again when a later release appears

#### Scenario: Once a day
- **WHEN** the app is opened again less than a day after the last check
- **THEN** it does not ask GitHub and uses the remembered answer

#### Scenario: GitHub Pages
- **WHEN** the app is served from a host ending in `github.io`
- **THEN** it does not ask GitHub and shows no notice

#### Scenario: Check fails
- **WHEN** the browser is offline, GitHub answers with an error or rate limit, or the answer is not a release
- **THEN** no notice and no error message are shown
