# Changelog

All notable changes to SnipSheet are documented here.

## [0.1.0] - 2026-11-11

### Added

- SnipSheet Activity Bar view with a persistent search field, six curated groups, and 16 bundled cheat sheets.
- Favorites section with per-sheet star toggles.
- In-view Options panel for hiding groups or individual sheets, hiding the Favorites section, resetting visibility, and opening settings.
- Editor-tab sheet viewer with the sheets' own search, copy actions and theme toggle preserved.
- User-scoped `snipsheet.favorites`, `snipsheet.hiddenGroups`, `snipsheet.hiddenSheets` and `snipsheet.showFavorites` settings.
- Offline security hardening: manifest path validation, strict CSP with per-render nonces, stripped font requests, https-only external links, and message validation.
- CI, manual tag/release workflow, unit tests, and packaging configuration.
