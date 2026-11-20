# Kopia UI specification

This folder describes the Kopia user interface in enough detail to build it again natively (WinUI 3 on Windows, SwiftUI on macOS) without reading the React code. It complements:

- [`../api/openapi.yaml`](../api/openapi.yaml) and [`../api/README.md`](../api/README.md): what the server accepts and returns.
- [`../native-clients-design.md`](../native-clients-design.md): architecture, process model, platform stacks.

The spec answers **what the user sees and what happens when they act**. The API docs answer **what goes over the wire**.

## Baseline

|        |                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Source | New UI in this repository, `src/app/**`, branch `new-ui`                                                                   |
| Commit | `db15ed8` ("Add CLI equivalents and running-tasks badge in the sidebar"), clean working tree for `src/app` and `tests/app` |
| Date   | 2026-11-16                                                                                                                 |

When the web UI changes, update the affected file here in the same commit. `tests/app/uiSpecVectors.test.ts` fails if a pure helper changes behaviour without [`test-vectors.json`](test-vectors.json) being regenerated, or if [`strings.json`](strings.json) contains text that no longer appears in `src/app`. (It doesn't catch new UI text missing from the catalog; add new strings by hand.)

## Files

| File                                                 | Contents                                                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [shell.md](shell.md)                                 | App frame: navigation, header, connection gate, global feedback (toasts, loaders, errors), polling, responsive rules                                       |
| [screens/snapshots.md](screens/snapshots.md)         | Snapshots dashboard                                                                                                                                        |
| [screens/new-snapshot.md](screens/new-snapshot.md)   | Add a folder / snapshot now, size estimate, policy preview                                                                                                 |
| [screens/source-detail.md](screens/source-detail.md) | Snapshot history of one folder, file browser, restore, pins, descriptions, delete                                                                          |
| [screens/policies.md](screens/policies.md)           | Policy list and policy editor                                                                                                                              |
| [screens/tasks.md](screens/tasks.md)                 | Task list and task details with live log                                                                                                                   |
| [screens/repository.md](screens/repository.md)       | Connected repository, setup wizard, switching repositories                                                                                                 |
| [screens/preferences.md](screens/preferences.md)     | Appearance settings and notification profiles                                                                                                              |
| [native-only.md](native-only.md)                     | Things the native clients need that the web UI doesn't have: tray/menu bar, server states, repository model, other storage types, throttling, pause/resume |
| [fields.md](fields.md)                               | Every form field: label, help text, type, validation, default, API path                                                                                    |
| [logic.md](logic.md)                                 | Every client-side rule (status derivation, formatting, parsing, request building) with its test vectors                                                    |
| [test-vectors.json](test-vectors.json)               | Inputs and expected outputs for the rules in logic.md, generated from the web UI's code                                                                    |
| [design-tokens.md](design-tokens.md)                 | Colors, semantic color roles, typography, spacing, radius, breakpoints, icons                                                                              |
| [strings.json](strings.json)                         | All user-visible text, keyed by screen                                                                                                                     |

## Conventions

- **Quoted text** like “Snapshot now” is exact UI text. It also appears in [strings.json](strings.json). Keep the wording identical across clients. `{name}` marks a value inserted at runtime.
- **API calls** are written `METHOD path` relative to `/api/v1` (e.g. `POST sources/upload`). Request and response shapes are in the OpenAPI spec.
- **Function names** in `code` (e.g. `sourceState`) refer to rules in [logic.md](logic.md).
- **Toast** means a transient notification in the top-right corner (Mantine `notifications.show`). Native equivalents: an in-app InfoBar / banner (Windows) or overlay (macOS), not an OS notification. OS notifications are reserved for background events ([native-only.md](native-only.md)).
- **Drawer** is a panel sliding in from the right over the page (size "xl" = 48.75 rem = 780 px, or the full width on narrow windows). Native equivalents: a split-view detail pane or a sheet.
- **Modal** is a centered dialog that blocks the page.

## Web-only details and their native decision

The web UI has details that only exist because it runs in a browser. Native clients handle them like this:

| Web detail                                                                                                                 | Where                         | Native decision                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| App served at `/`; URLs are the Kopia server's UI routes (`/snapshots…`, `/policies…`, `/tasks…`, `/repo`, `/preferences`) | `App.tsx`                     | No URLs. Keep the route names as internal navigation IDs (table in [shell.md](shell.md)) so deep links from notifications work. |
| Version in the sidebar footer, read from a hidden element in `index.html` that the build and the Kopia server fill in      | `version.ts`, `AppLayout.tsx` | Show the app's own version.                                                                                                     |
| Dev mock mode (`?mock=1`)                                                                                                  | `devMock*.ts`                 | Drop. Use a fake API client in tests instead.                                                                                   |
| Theme and “Show CLI equivalents” stored in `localStorage`                                                                  | `cli.tsx`, Mantine            | Store in local app settings.                                                                                                    |
| Known repositories stored in `localStorage`                                                                                | `knownRepos.ts`               | Replaced by the native repository model ([native-only.md](native-only.md#repository-model)).                                    |
| Path placeholders chosen with `navigator.platform`                                                                         | New snapshot, setup wizard    | Use the OS the app runs on.                                                                                                     |
| File download through `<a href download>`                                                                                  | Snapshot browser              | Fetch `GET objects/{id}` and save through the OS save dialog.                                                                   |
| Folder picker only in KopiaUI (`window.kopiaUI.selectDirectory`)                                                           | `PathField.tsx`               | Always show “Browse…” with the native folder picker. Keep the suggestions.                                                      |
| “Open in file manager” only in KopiaUI (`window.kopiaUI.browseDirectory`)                                                  | Snapshot browser              | Always available (Explorer / Finder).                                                                                           |
| Phone layout (< 48 em)                                                                                                     | Several screens               | Not needed. Minimum window width 900 px (see [shell.md](shell.md#window-sizes)).                                                |
| Polling pauses while the browser tab is hidden                                                                             | `usePolling.ts`               | Pause while the window is hidden or minimized. The tray keeps its own poll.                                                     |

## Known divergences in the web UI

These are recorded as the web UI behaves today. Native clients **match** them unless this table says otherwise, so both UIs show the same thing. Fix them in the web UI first, then update the spec.

| #   | Behaviour                                                                                                                                                                                                                                                                                                                         | Where                                           | Native                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| D1  | `sourceState` has no case for server status `FAILED` or `REMOTE`; both show as “Protected” (or “Overdue” / “Never backed up”).                                                                                                                                                                                                    | `sourceStatus.ts`                               | Match. Proposed fix: show `FAILED` as a red “Failed” badge.                                |
| D2  | Task log lines with `level >= 1` are bold, assuming 1 = notice. The server uses 0 debug, 1 info, 2 warning, 3 error, so every info line is bold.                                                                                                                                                                                  | `TaskDrawer.tsx`, `taskFormat.tsx`              | Diverge: bold only `level >= 2`.                                                           |
| D3  | Byte-valued policy fields show “Effective: …” in base-10 units even when the user chose base-2.                                                                                                                                                                                                                                   | `PolicyFields.tsx` (`NumberField` with `bytes`) | Diverge: use the user's unit setting.                                                      |
| D4  | The snapshot browser offers restore for folders only; single files can only be downloaded.                                                                                                                                                                                                                                        | `SnapshotBrowser.tsx`                           | Match for v1.                                                                              |
| D5  | `sizeDisplayName` stops at TB without dividing further correctly: 3 PB shows as “3 TB”.                                                                                                                                                                                                                                           | `utils/formatutils.js`                          | Diverge: show “3000 TB” (keep TB as the largest unit, keep dividing correctly).            |
| D6  | Policy editor has no fields for `osSnapshots.volumeShadowCopy.enable`, `compression.noParentOnlyCompress`, `compression.noParentNeverCompress`, `scheduling.noParentTimeOfDay`, `upload.parallelUploadAboveSize`, `metadataCompression`, `splitter`. Values set elsewhere survive a save (the editor round-trips unknown fields). | `PolicyEditor.tsx`                              | Match, but add “Volume shadow copy” on Windows (see [fields.md](fields.md#policy-editor)). |
| D7  | `ui-preferences` save sends every stored field back; fields the server doesn't know are dropped by the server.                                                                                                                                                                                                                    | `preferences.tsx`                               | Match.                                                                                     |
