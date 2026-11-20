# App shell

Source: `src/app/App.tsx`, `AppLayout.tsx`, `repoStatus.tsx`, `preferences.tsx`, `components.tsx`, `api/usePolling.ts`, `api/hooks.ts`.

## Layout

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ [logo] Kopia ▾                                   (● 2 running)  [☾]      │ header, 60 px
│        My Repository                                                      │
├──────────────┬────────────────────────────────────────────────────────────┤
│ Snapshots    │                                                            │
│ Policies     │   page content (padding 20 px)                             │
│ Tasks     2  │                                                            │
│ Repository   │                                                            │
│ Preferences  │                                                            │
│              │                                                            │
│ ● Connected  │                                                            │
└──────────────┴────────────────────────────────────────────────────────────┘
  sidebar 240 px
```

### Header

- **Logo** (`public/kopia-flat.svg`, 36 × 25) followed by the **repository switcher**:
  - Line 1: “Kopia” (bold).
  - Line 2 (only when connected and the repository has a description): the description, small and dimmed, truncated.
  - If at least one known repository exists, the title is a button with a chevron (Tabler `IconSelector`) that opens a menu:
    - Label “Repositories”.
    - One item per known repository, newest `lastConnected` first: description (or “Unnamed repository”) and its path below. The current repository shows a check icon and is disabled; the others show a folder icon and open the switch dialog ([repository.md](screens/repository.md#switch-repository-dialog)).
    - Divider, then “Manage repositories” (settings icon) → Repository screen.
- **Running badge** (right side, only when `runningCount > 0`): a light badge “{n} running” with a pulsing dot. Clicking it opens Tasks filtered to running.
- **Color scheme toggle**: icon button. Shows a sun in dark mode (tooltip “Light mode”) and a moon in light mode (tooltip “Dark mode”). Toggles between explicit light and dark. The setting persists locally. Preferences also offers “Auto” ([preferences.md](screens/preferences.md)).

`runningCount` = `RUNNING` count from `GET tasks-summary`, polled every 5 s while connected.

### Sidebar

Five entries, each with an icon (Tabler names; native glyphs are suggestions in [design-tokens.md](design-tokens.md#icons)):

| Label       | Icon              | Target                                                                                            |
| ----------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| Snapshots   | `IconArchive`     | Snapshots dashboard                                                                               |
| Policies    | `IconShieldCheck` | Policies                                                                                          |
| Tasks       | `IconListCheck`   | Tasks. Shows a small circular badge with `runningCount` when > 0 (accessible name “{n} running”). |
| Repository  | `IconDatabase`    | Repository                                                                                        |
| Preferences | `IconSettings`    | Preferences                                                                                       |

The active entry is highlighted (light variant of the primary color). An entry stays active on its sub-screens (e.g. Snapshots stays active on New snapshot and Source detail).

Footer: a dot badge “Connected” (green) or “Not connected” (gray), shown once the status is known, followed by the version (e.g. “v0.21.1”, full build info as tooltip) when known.

## Navigation targets

The web UI uses URLs. Native clients use the same names as navigation IDs, so deep links (from notifications, the tray, the running badge) have one vocabulary.

| ID                        | Web route                                     | Screen                          | Needs connection | Parameters                                                        |
| ------------------------- | --------------------------------------------- | ------------------------------- | ---------------- | ----------------------------------------------------------------- |
| `snapshots`               | `/snapshots` (also `/` and any unknown route) | Snapshots dashboard             | yes              | —                                                                 |
| `snapshots/new`           | `/snapshots/new`                              | New snapshot                    | yes              | —                                                                 |
| `snapshots/single-source` | `/snapshots/single-source?userName&host&path` | Source detail                   | yes              | source                                                            |
| `policies`                | `/policies`                                   | Policies                        | yes              | —                                                                 |
| `policies/edit`           | `/policies/edit?userName&host&path`           | Policies with the editor open   | yes              | policy target (all three, empty for unused parts)                 |
| `tasks`                   | `/tasks?status&kind`                          | Tasks                           | yes              | `status`: `running` \| `failed` (absent = all); `kind`: task kind |
| `tasks/{id}`              | `/tasks/:tid`                                 | Tasks with the task drawer open | yes              | task id; keeps `status`/`kind`                                    |
| `repo`                    | `/repo?switch={knownRepoId}`                  | Repository                      | no               | optional repository to switch to                                  |
| `preferences`             | `/preferences`                                | Preferences                     | no               | —                                                                 |

## Connection gate

Screens marked “needs connection” render through a gate that reads the repository status (`GET repo/status`):

| Condition (checked in order)           | Shown instead of the screen                 |
| -------------------------------------- | ------------------------------------------- |
| First status request still loading     | Centered spinner                            |
| Request failed and no status known yet | **Server unreachable** panel (below)        |
| `initTaskID` is set                    | Centered spinner with “Opening repository…” |
| `connected` is false                   | **Not connected** panel (below)             |
| otherwise                              | The screen                                  |

The Repository screen applies the first three rows itself. Preferences never blocks.

**Server unreachable** panel: red alert, title “Cannot reach the Kopia server”, the error message, and a light red button “Try again” that re-fetches the status. Native clients show the server host state instead ([native-only.md](native-only.md#server-states)), but keep this panel for a server that is running but not answering.

**Not connected** panel (centered, max 420 px wide): gray circular icon (`IconDatabaseOff`), title “Not connected to a repository”, text “Connect to an existing repository or create a new one to start backing up.”, primary button “Set up repository” → Repository screen.

### When the status is refreshed

- Once at startup.
- Every **1 s** while `initTaskID` is set; it stops when that clears.
- Whenever any API call fails with `NOT_CONNECTED`. The gate then switches to the Not connected panel on its own.
- Explicitly after connect, create, disconnect, switch and description changes.

## Server-side preferences

Loaded once at startup from `GET ui-preferences`. The UI uses two fields:

| Field                    | Default | Effect                                                                 |
| ------------------------ | ------- | ---------------------------------------------------------------------- |
| `bytesStringBase2`       | false   | Sizes use 1024-based units (KiB, MiB…) everywhere.                     |
| `defaultSnapshotViewAll` | false   | Snapshots dashboard starts with “All owners” instead of this computer. |

Saving a preference re-reads `GET ui-preferences`, merges the change in and sends the whole object with `PUT ui-preferences`, then reloads. Controls that change these are disabled until the first load finishes (success or failure).

## Global feedback patterns

| Situation                                | Pattern                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screen data loading for the first time   | Spinner centered in the content area (or in the card that is loading). The page header stays visible.                                                |
| Screen data failed and nothing is cached | Red alert with a title like “Could not load {thing}” and the server message.                                                                         |
| A poll fails but earlier data exists     | Keep showing the old data. The Snapshots dashboard also shows a yellow alert “Showing last known state” with the message.                            |
| A button's action is running             | That button shows a spinner and ignores clicks. Other buttons stay usable unless stated.                                                             |
| An action failed                         | Red toast: title from the action (“Could not start snapshot”), message = server error text. Forms show the error inline instead (stated per screen). |
| An action succeeded                      | Green toast only where stated per screen. Many actions just refresh the data.                                                                        |
| Destructive action                       | Confirmation modal with a red confirm button. Text says what is deleted and that it can't be undone.                                                 |

Toasts appear top-right and close after a few seconds. Toast messages may contain a link (e.g. “Show progress” after starting a restore).

## Polling

Polling rules come from `api/hooks.ts` and `api/usePolling.ts`:

| Data                  | Interval | Notes                                                                   |
| --------------------- | -------- | ----------------------------------------------------------------------- |
| `GET tasks-summary`   | 5 s      | Only while connected. Feeds the running badge.                          |
| `GET sources`         | 3 s      | Snapshots dashboard, source detail, policies (for the local user/host). |
| `GET tasks`           | 3 s      | Tasks screen.                                                           |
| `GET tasks/{id}`      | 0.5 s    | Until the task has `endTime`.                                           |
| `GET tasks/{id}/logs` | 3 s      | While the task runs (“follow”).                                         |
| `GET repo/status`     | 1 s      | Only while `initTaskID` is set.                                         |
| everything else       | once     | Re-fetched when its parameters change or after a mutation.              |

Behaviour of every poll:

- **No overlap.** A poll waits for the previous request to finish before scheduling the next.
- **Pause while hidden.** If the window is hidden when a poll is due, it waits and fires as soon as the window is visible again.
- **Keep data on error.** A failed poll sets the error but keeps the last good data.
- **Cancel on leave.** Leaving a screen, or changing a parameter, cancels in-flight requests. A canceled request never shows an error.
- **Refresh after mutation.** After a successful action, the affected data is refetched immediately (and the timer restarts).

## Time and number display

- Relative times (`relativeTime`): “just now”, “5 minutes ago”, “in 2 hours”, “yesterday”, “last month”. English, numeric “auto”. Screens that show relative times recompute them every 30 s even without new data (the dashboard does this explicitly).
- Absolute times (`absoluteTime`): the OS's local date-time format. Shown as a tooltip on relative times, and directly in tables where stated.
- Sizes (`sizeDisplayName`): one decimal, units B/KB/MB/GB/TB or B/KiB/MiB/GiB/TiB.
- Durations (`formatDuration`): “2.5s”, “45s”, “1m 5s”, “1h 2m 3s”, “1d 3h”.
- Counts: thousands separators (`toLocaleString`).

Exact rules and examples: [logic.md](logic.md).

## CLI equivalents

When “Show CLI equivalents” is on (Preferences, off by default, stored locally), several screens show a line under their main content:

```text
>_  kopia snapshot list                                     [copy]
```

- Terminal icon (tooltip “Command line equivalent”), then `kopia {command}` in monospace, horizontally scrollable.
- The copy button copies the **full** command: the executable path from `GET cli` (which includes `--config-file`) followed by the command. Tooltip “Copy full command”, then “Copied”.
- The command per screen is listed in each screen spec.

## Window sizes

The web UI collapses the sidebar under 48 em (768 px) and switches some tables to lists. Native clients:

- Minimum window size 900 × 600.
- The sidebar can collapse to icons (Windows `NavigationView` compact mode, macOS sidebar toggle). It doesn't need a hamburger overlay.
- Tables scroll horizontally below their minimum width (stated per table), as in the web UI.
