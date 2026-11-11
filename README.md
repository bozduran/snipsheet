# SnipSheet

[![CI](https://github.com/bozduran/snipsheet/actions/workflows/ci.yml/badge.svg)](https://github.com/bozduran/snipsheet/actions/workflows/ci.yml)

Offline cheat sheets in your editor sidebar. SnipSheet bundles 16 curated command references, groups them by topic, lets you pin favorites, and hides the groups or individual sheets you do not need.

- **Search at the top of the sidebar** across titles, descriptions, keywords and group names.
- **Six groups**: Git & GitHub, Containers, Java & Spring, Salesforce, Reporting & Data, Languages & Syntax.
- **Collapsible groups**: click a group heading to fold it away; collapsed groups are remembered across reloads and expand automatically while searching.
- **Favorites** stay pinned in their own section and remain in their normal group.
- **Options** lets you hide whole groups or individual sheets; every change is written to your user settings immediately.
- **Sheets open in editor tabs** with their own search, copy buttons and theme toggle intact.
- **No network, no telemetry, no runtime dependencies.**

## Install

Download the latest `snipsheet-<version>.vsix` from the [Releases](https://github.com/bozduran/snipsheet/releases) page, then run:

```bash
code --install-extension snipsheet-<version>.vsix
```

From source:

```bash
npm ci
npm run package
code --install-extension snipsheet.vsix
```

## Use

Click the SnipSheet icon in the Activity Bar. Type in the search box to filter; press `Escape` to clear the search, or use the `×` button. Click a sheet to open it. Click the star to add or remove a favorite. Click a group heading to collapse or expand it; collapse choices are remembered, and groups expand temporarily while a search is active so matches stay visible.

Open **Options** with the sliders button in the search row, the gear in the view title, or the Command Palette. Options contains:

- visibility switches for each group and each sheet,
- a switch for the Favorites section,
- **Reset visibility** (groups, sheets and the Favorites section),
- **Open Settings**, filtered to SnipSheet's settings.

Hiding a group hides all of its sheets. A hidden sheet stays hidden even if it is favorited, and its star is kept for when you unhide it. The **Favorites** section is hidden automatically when it is empty or disabled.

## Settings

All settings are user-scoped (`application`) and sync with Settings Sync where enabled. The Options panel writes them for you.

| Setting | Type | Default | Purpose |
| --- | --- | --- | --- |
| `snipsheet.favorites` | `string[]` | `[]` | Sheet ids pinned to Favorites. |
| `snipsheet.hiddenGroups` | `string[]` | `[]` | Group ids hidden from the sidebar. |
| `snipsheet.hiddenSheets` | `string[]` | `[]` | Sheet ids hidden from the sidebar. |
| `snipsheet.showFavorites` | `boolean` | `true` | Show the Favorites section. |

Unknown ids in these arrays are ignored, so a hand-edited setting can never point the extension at an arbitrary file.

## Commands

| Command | Description |
| --- | --- |
| `SnipSheet: Focus SnipSheet` | Reveal the sidebar. |
| `SnipSheet: Open SnipSheet Options` | Open the in-sidebar Options panel. |
| `SnipSheet: Open Cheat Sheet...` | Pick a visible sheet with Quick Pick. |
| `SnipSheet: Reset SnipSheet Visibility` | Unhide every group and sheet. |

## Security model

SnipSheet is deliberately small and treats its own sidebar and sheets as separate trust boundaries.

- **Bundled content only.** The extension reads HTML only from `cheatsheets/` inside the installed VSIX. The manifest validates every file name against a narrow direct-child `.html` pattern; separators, `..` and absolute paths are rejected.
- **Strict CSP.** The sidebar allows only its own stylesheet and nonce-approved scripts. Sheet tabs load with `default-src 'none'`, nonce-approved inline script/style, and no `connect-src`. There is no `unsafe-inline` or `unsafe-eval`.
- **No remote resources.** Google Fonts links are stripped when a sheet is opened, so sheets stay offline and fall back to local fonts. External links open the browser only after a user click, and only `https:` URLs without embedded credentials are accepted.
- **Validated messages.** The sidebar can send only a fixed vocabulary of messages, and ids must exist in the catalog. Sheet tabs can send only `copy` and `openExternal`; copy text is length-capped.
- **No command execution.** The extension never runs a shell, reads workspace files, or evaluates sheet content in the extension host.
- **Least privilege.** The CI workflow has read-only repository access. Only the release workflow can write, and only to create the release commit, tag, and GitHub Release. No Marketplace token is stored in the repository.
- **Zero runtime dependencies.** The packaged extension ships no `node_modules`.

The bundled sheets are first-party content. Their inline scripts render the page and implement copy/search; they are nonce-approved because the pages are JavaScript-generated. The CI tests scan the sheets for remote scripts, `eval`, `fetch`, storage and similar APIs, and verify the transformed output stays under the CSP.

## Adding or changing a sheet

1. Add the `.html` file under `cheatsheets/`. Do not use `cheatsheet-template.html` as a content page.
2. Add its id, title, group, description and search keywords to `cheatsheets/manifest.json`.
3. Run `npm run verify`. The tests check that every non-template HTML file has exactly one manifest entry, that paths are safe, and that the sheet has no remote scripts or unexpected network references.

The six groups and their descriptions also live in the manifest.

## Development

Requires Node.js 22 or newer for the toolchain.

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run package        # verify + snipsheet.vsix
```

`npm run watch` rebuilds the extension and sidebar bundles while developing. Use the **Run Extension** launch configuration to open an Extension Development Host.

The extension entry point is bundled to `dist/extension.js`; the sidebar client is bundled to `media/webview.js`. Webview source is under `src/webview/`; the rest of the logic is plain TypeScript with no runtime dependencies.

## CI and releases

- **CI** runs on pull requests and on pushes to `master`: lint, typecheck, unit tests, bundle, and package. A push/merge to `master` also uploads the VSIX as the `snipsheet-vsix` artifact.
- **Release** is a manual `workflow_dispatch` with a `patch` / `minor` / `major` bump. It verifies the code, runs `npm version`, pushes the release commit and `vX.Y.Z` tag atomically, packages the VSIX, and creates a GitHub Release. Pushing an existing `vX.Y.Z` tag validates that the tag matches `package.json` and creates the release for it.
- Tag pushes are checked against `package.json`; a mismatched tag fails instead of publishing the wrong version.

## Publishing later

The publisher is `BozNtouranLabs`. The release workflow intentionally does not publish to the Marketplace yet. To publish a verified VSIX manually:

```bash
npx @vscode/vsce publish --packagePath snipsheet-<version>.vsix
```

with a `VSCE_PAT` in the environment. A future workflow can add a publish job guarded by that secret without changing how the VSIX is built.

## License

MIT. See [LICENSE.md](LICENSE.md).
