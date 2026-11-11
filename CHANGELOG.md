# Changelog

All notable changes to SnipSheet are documented here.

## [0.1.0] - 2026-11-11

### Added

- SnipSheet Activity Bar view with a persistent search field, seven curated groups, and 18 bundled cheat sheets.
- Collapsible group headings; collapse state is remembered across reloads and groups expand while searching.
- Favorites section with per-sheet star toggles.
- New Claude Code and PowerShell sheets, and an updated Git sheet.
- In-view Options panel for hiding groups or individual sheets, hiding the Favorites section, resetting visibility, and opening settings.
- Editor-tab sheet viewer with the sheets' own search, copy actions and theme toggle preserved.
- User-scoped `snipsheet.favorites`, `snipsheet.hiddenGroups`, `snipsheet.hiddenSheets` and `snipsheet.showFavorites` settings.
- Offline security hardening: manifest path validation, strict CSP with per-render nonces, stripped font requests, https-only external links, and message validation.
- CI, manual tag/release workflow, unit tests, and packaging configuration.

### Fixed

- Reset visibility also restores the Favorites section, and the Reset button is enabled when only that section is hidden.
- Sheet documents keep `<meta charset>` inside the 1024-byte encoding prescan window; CSP and the webview shim are injected after it.
- The sheet link interceptor accepts `https:` only, matching the host-side link policy.
