# Pi extension audit — 2026-10-01

Dates use Asia/Tokyo. The age threshold is 2026-09-01. Git dates show the last source commit. For npm packages, the report also shows the latest release date. An old release does not mean that a project is abandoned.

## Changes

- Remove `npm:@mariozechner/pi-coding-agent` from declared packages. It is the deprecated 0.73.1 CLI, not an extension. The active CLI is the mise binary at version 0.87.1. Its loader supports legacy imports through embedded modules.
- Remove `npm:pi-startup-header` from declared packages. It was already disabled. The local `pi-splash` supplies the header. Keep `pi-startup-header.json`: the splash still reads its colors.
- Remove `npm:pi-terminal-theme` from declared packages. The active theme is `dark`, and the Omarchy extension selects the built-in `light` or `dark` theme. The package only supplies two optional theme files.
- Archive five old directories from `~/.pi/agent/extensions`: `pi-web-access`, `pi-tool-display`, `pi-mermaid`, `tmustier-pi-extensions`, and `bug-hunter`. Keep the managed Git copies. Preserve local lockfile changes in the archive.
- Fix the package filters for the four managed extension packages. Pi 0.87.1 does not match plain `./index.ts` filters to `index.ts`. Use paths without `./`. Keep only the five selected tmustier extensions; games, Ralph, guidance, and recap are not selected.
- Correct the repository's pi-memory entry to `dist/index.js`, its current manifest entry. The local unfiltered pi-memory package already loads this file.
- Change the Candy terminal check to use the managed raw-paste extension.
- Remove `npm:@dietrichgebert/ponytail` and `npm:pi-simplify` at the user's request. Neither code review workflow is needed. Remove both from the live profile and the repository template, and uninstall their npm packages.

The first cleanup reduced package declarations from 19 to 16 on this machine. The follow-up removal of Ponytail and pi-simplify reduces them to 14. The npm cache for the first cleanup is kept. Only the two packages selected for the follow-up are uninstalled; other downloaded files are kept.

## Runtime findings

Before cleanup, the native Pi resource resolver enabled 33 extension entries. The managed Git copies of web access, tool display, Mermaid, and tmustier were disabled by their filters. Pi loaded their old auto-discovered directories instead. There were duplicate files on disk, but those pairs were not both active.

The old tmustier directory enabled 13 entries. Its managed replacement selects only five. The old bug-hunter directory has no extension entry and is inactive as an extension. Its managed package is kept because its prompts still load.

`pi-lsp-extension` is currently inactive: its configured `src/index.ts` does not match the manifest's `dist/index.js`. `pi-lens` is active. Do not enable both just to fix this mismatch; first choose the needed tools.

The bug-hunter package's root `SKILL.md` is not in the convention-based skill set discovered by Pi. Its current filter does not load the main skill. This audit keeps its existing prompts and does not silently add the full skill suite.

## Further cleanup candidates

| Package | Overlap | Decision |
| --- | --- | --- |
| `pi-simplify` | Ponytail `/ponytail-review` can review a diff for simpler code. | Removed at the user's request, together with Ponytail. The user does not need either workflow. |
| `@dietrichgebert/ponytail` | Its review commands overlap with code review workflows. | Removed at the user's request. Its commands and bundled skills are no longer selected. |
| `pi-lsp-extension` | Active `pi-lens` supplies diagnostics, navigation, rename, and AST features. | Its declaration can be removed without changing the current active tool set. Keep pending a choice if Java Lombok, shared LSP daemons, completion, or its command interface is needed. |
| `pi-tool-display` | Candy exposes the core expansion switch. | Keep the managed copy. Candy does not replace its compact tool and diff renderer. |
| `pi-mermaid` | Sideshow can show diagrams in a browser. | Keep the managed copy. It renders diagrams inside the terminal. |
| `pi-manage-todo-list` | Other agents can write plans. | Keep. Its explicit TODO tool is a separate function. |
| `bug-hunter` | The removed Ponytail package could also audit code. | Keep. Bug hunting and security verification are separate functions. |
| `context-mode` | pi-memory stores durable context. | Keep. Indexing and result compression differ from durable memory. Source activity continues despite the older npm release. |

## Validation

- The native Pi 0.87.1 resolver enables 25 entries after cleanup, down from 33. No archived directory or unselected arcade entry is enabled.
- All 25 retained extension factories load with no errors under normal filesystem access. The restricted probe could not open context-mode's SQLite database; the check passed when repeated with normal access. This check does not run session hooks or exercise external services.
- `python3 tests/verify-candy-ui.py` passed with the managed raw-paste extension. It checks native `/model`, Ctrl+L, unfold and fold animation, search, default model persistence, drafts, resize, off/on, and long Chinese paste. It uses isolated settings and local test models.
- The live settings match the proposed settings. Other settings are unchanged. All five archived directories and the original settings are present in the backup.
- JSON parsing, Python syntax, and `git diff --check` passed. No logic in the UI or update launcher changed.
- After the follow-up removal, the native resolver finds no missing packages and no Ponytail or pi-simplify resources. All 23 remaining extension factories load with no errors. `/simplify`, `/ponytail*`, and Ponytail's bundled skills are absent. This check does not run session hooks or request a model response.
- The follow-up changes only the two package entries in each settings file and the two npm dependency requirements. All other settings and package requirements are unchanged.

## Maintenance dates

| Package / source | Last source commit | Latest npm release |
| --- | --- | --- |
| [github.com/nicobailon/pi-web-access](https://github.com/nicobailon/pi-web-access) | 2026-10-01 | — |
| [github.com/MasuRii/pi-tool-display](https://github.com/MasuRii/pi-tool-display) | 2026-07-03 | — |
| [github.com/Gurpartap/pi-mermaid](https://github.com/Gurpartap/pi-mermaid) | 2026-02-24 | — |
| [github.com/tmustier/pi-extensions](https://github.com/tmustier/pi-extensions) | 2026-09-22 | — |
| [github.com/codexstar69/bug-hunter](https://github.com/codexstar69/bug-hunter) | 2026-08-17 | — |
| [github.com/samfoy/pi-lsp-extension](https://github.com/samfoy/pi-lsp-extension) | 2026-09-25 | — |
| [@plannotator/pi-extension](https://github.com/backnotprop/plannotator) | 2026-10-01 | 2026-10-01 |
| [@mariozechner/pi-coding-agent](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) | Deprecated npm namespace | 2026-05-07 |
| [pi-subagents](https://github.com/nicobailon/pi-subagents) | 2026-10-01 | 2026-10-01 |
| [context-mode](https://github.com/mksglu/context-mode) | 2026-10-01 | 2026-06-30 |
| [@dietrichgebert/ponytail](https://github.com/DietrichGebert/ponytail) | 2026-09-14 | 2026-09-14 |
| [pi-lens](https://github.com/apmantza/pi-lens) | 2026-10-01 | 2026-09-25 |
| [pi-simplify](https://github.com/MattDevy/pi-extensions) | 2026-07-17 | 2026-07-17 |
| [pi-terminal-theme](https://github.com/mavam/pi-terminal-theme) | 2026-07-06 | 2026-05-20 |
| [pi-prompt-template-model](https://github.com/nicobailon/pi-prompt-template-model) | 2026-09-22 | 2026-09-22 |
| [pi-manage-todo-list](https://github.com/tintinweb/pi-manage-todo-list) | 2026-05-31 | 2026-05-31 |
| [pi-startup-header](https://github.com/EnderLiquid/pi-startup-header) | 2026-09-22 | 2026-09-22 |
| [sideshow](https://github.com/modem-dev/sideshow) | 2026-09-07 | 2026-09-07 |
| [github.com/samfoy/pi-memory](https://github.com/samfoy/pi-memory) | 2026-09-25 | — |

Metadata was checked with the GitHub API and npm registry. The source date for `pi-simplify` is scoped to its package directory; the date for Plannotator is scoped to `apps/pi-extension`. Repository activity is a signal, not a guarantee of runtime compatibility.

## Recovery

The local archive is under `~/.local/state/pi-dotfiles/backups/plugins-*/`. Its `cleanup.json` lists the moved directories and removed package sources. Restore individual directories or settings as needed; do not overwrite later settings changes with an old whole-file backup. Never restore both a local auto-discovered copy and an enabled managed copy of the same extension.

The Ponytail and pi-simplify follow-up backup is under `~/.local/state/pi-dotfiles/backups/remove-unused-20261001T024221Z-eusf59lb/`. It includes the original settings, npm manifest and lockfile, and both package directories. Restore only the needed entries and files; keep later changes.

Recovery archives and machine-specific state are not included in this repository.
