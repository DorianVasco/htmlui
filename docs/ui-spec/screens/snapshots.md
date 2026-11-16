# Snapshots dashboard

Navigation ID `snapshots`. Source: `src/app/pages/DashboardPage.tsx`, `src/app/sourceStatus.ts`.

Shows every folder (“source”) backed up into the repository, its state and live progress, with actions to start or stop a snapshot.

## Data

| Call                                     | When                     |
| ---------------------------------------- | ------------------------ |
| `GET sources`                            | Polled every 3 s         |
| `POST sources/upload?userName&host&path` | “Snapshot now” on a row  |
| `POST sources/cancel?userName&host&path` | “Stop snapshot” on a row |
| `POST repo/sync`                         | Synchronize button       |

## Layout

```text
Snapshots                                          [⟳]  [+ New snapshot]
Everything that is backed up into this repository.

┌ SOURCES ──┐ ┌ PROTECTED DATA ┐ ┌ NEXT SNAPSHOT ┐ ┌ NEEDS ATTENTION ┐
│ 4         │ │ 12.3 GB        │ │ in 2 hours    │ │ 1               │
│ 3 with sn…│ │ size of latest…│ │ /home/me/Docs │ │ 1 with errors   │
└───────────┘ └────────────────┘ └───────────────┘ └─────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│ [🔍 Filter by path or owner]                   [This computer (me@pc)▾]│
├───────────────────────────────────────────────────────────────────────┤
│ Path               Status        Last snapshot     Size   Next     ⋯  │
│ 📁 /home/me/Docs   Protected     2 hours ago       1.2 GB in 2 hours ▶ ⋯│
│    me@pc                                                              │
│ 📁 /home/me/Pics   Uploading 42% 3 days ago  ⚠2    8 GB            ■ ⋯│
│                    ▓▓▓▓░░░ 3.4 GB / 8.1 GB                            │
└───────────────────────────────────────────────────────────────────────┘
>_ kopia snapshot list
```

### Header

- Title “Snapshots”, description “Everything that is backed up into this repository.”
- **Synchronize** icon button (`IconRefresh`, tooltip “Synchronize with repository”, accessible name “Synchronize”). Calls `POST repo/sync`, then refetches sources. Spinner while running. Failure → red toast “Synchronization failed”.
- **New snapshot** primary button (`IconPlus`) → `snapshots/new`.

### Owner scope

`localOwner` = `{localUsername}@{localHost}` from `GET sources`.

- If `multiUser` is **false**, all sources are shown and there is no owner selector.
- If `multiUser` is **true**, an owner selector appears in the table toolbar (240 px):
  - Group “Show”: “This computer ({localOwner})” and “All owners”.
  - Group “Owner”: every distinct `user@host` among the sources, sorted.
  - Initial value: “All owners” if the preference `defaultSnapshotViewAll` is on, otherwise “This computer”. The choice isn't persisted.
- The stat cards and the table both use the scoped list (`filterByOwner`).

### Stat cards

Four cards in a row (two per row below 75 em). Each card: uppercase dimmed label, large value, small dimmed hint (truncated), and a colored icon on the right.

| Label           | Value                                             | Hint                                                                                                                      | Icon / color                                  |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Sources         | number of scoped sources                          | “{n} with snapshots” (sources with a `lastSnapshot`)                                                                      | `IconArchive`, primary                        |
| Protected data  | sum of `totalSize` over scoped sources, formatted | “size of latest snapshots”                                                                                                | `IconDatabase`, cyan                          |
| Next snapshot   | `relativeTime` of `nextScheduled(...)`, or “—”    | that source's path, or “nothing scheduled”                                                                                | `IconClockPlay`, blue                         |
| Needs attention | number of sources where `needsAttention`          | parts joined by “ · ”: “{n} with errors” (sources with `failedCount > 0`), “{n} overdue” (the rest); or “all good” when 0 | `IconAlertTriangle`, orange if > 0 else green |

### Table

Toolbar: a search field (placeholder “Filter by path or owner”, search icon, 280 px, accessible name “Filter sources”) and the owner selector (above).

**Filter**: case-insensitive substring of the path or of `user@host`, trimmed. **Sort**: by path, then by owner (locale compare).

Minimum width 820 px; scrolls horizontally below that.

| Column                                             | Content                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Path                                               | Folder icon (primary color), path as a bold link → source detail (wraps anywhere), owner `user@host` dimmed below. |
| Status                                             | Status cell (below).                                                                                               |
| Last snapshot                                      | `relativeTime(lastSnapshot.startTime)` with the absolute time as tooltip, or “—”. Followed by the error badge.     |
| Size (right-aligned, monospace)                    | `sizeDisplayName(totalSize)`, or “—” when never backed up.                                                         |
| Next                                               | Next-snapshot cell (below).                                                                                        |
| (actions, 90 px, header visually hidden “Actions”) | Row actions (below).                                                                                               |

**Status cell** by `sourceState`:

| State       | Display                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uploading` | Two-line block, min 150 px. Line 1: “Uploading {percent}%” (blue, bold), or “Uploading…” when there is no percent; right-aligned dimmed size text “{done} / {estimated}” (or just “{done}”). Line 2: progress bar, value = percent, or a full striped animated bar when there is no percent. Tooltip on the bar: “{files} files · {current directory}”, or “Uploading”. Values from `uploadProgress`. |
| `pending`   | Gray light badge “Pending” with a small spinner. Tooltip “Starts after the previous snapshot completes”.                                                                                                                                                                                                                                                                                              |
| `paused`    | Gray light badge “Paused”.                                                                                                                                                                                                                                                                                                                                                                            |
| `never`     | Gray outline badge “Never backed up”.                                                                                                                                                                                                                                                                                                                                                                 |
| `overdue`   | Yellow light badge “Overdue” with a warning icon.                                                                                                                                                                                                                                                                                                                                                     |
| `ok`        | Green light badge “Protected”.                                                                                                                                                                                                                                                                                                                                                                        |

**Error badge** (only when `failedCount > 0`): small orange badge with a warning icon, “{n} error” / “{n} errors”. Tooltip: `failureDetails` (one “path: error” per line, max 420 px wide), or “{n} errors” if there are no details.

**Next-snapshot cell**:

- Nothing while uploading.
- No `nextSnapshotTime`: dimmed “paused” if the status is `PAUSED`, else dimmed “manual”.
- Otherwise `relativeTime(nextSnapshotTime)` with absolute tooltip, plus a small yellow badge “overdue” when `isOverdue`.

**Row actions**:

- If `isActive` (uploading or pending): red icon button “Stop snapshot” (`IconPlayerStop`) → `POST sources/cancel`. Otherwise icon button “Snapshot now” (`IconPlayerPlay`) → `POST sources/upload`. While the call runs, the button for **that row** shows a spinner. On success, sources are refetched. Failure → red toast “Could not start snapshot” / “Could not stop snapshot”.
- “More actions” menu (`IconDots`):
  - “Snapshot history” (`IconHistory`) → source detail.
  - “Edit policy” (`IconShieldCheck`) → `policies/edit` for this source.
  - “Task details” (`IconListDetails`), only when `currentTask` is set → `tasks/{currentTask}`.

### States

| State                        | Display                                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| First load                   | Header, then a centered spinner.                                                                                                          |
| Load failed, no data         | Header, then red alert “Could not load snapshot sources” with the message.                                                                |
| Poll failed, data cached     | Yellow alert “Showing last known state” with the message, above the cards. Everything else stays.                                         |
| No sources at all            | Inside the table card: dimmed “Nothing is backed up yet.” and a light button “Create your first snapshot” (`IconPlus`) → `snapshots/new`. |
| Sources exist but none match | Dimmed “No sources match the filter.”                                                                                                     |

Relative times on this screen are recomputed every 30 s.

CLI equivalent: `snapshot list`.
