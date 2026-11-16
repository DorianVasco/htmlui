# New snapshot

Navigation ID `snapshots/new`. Source: `src/app/pages/NewSnapshotPage.tsx`, `src/app/PathField.tsx`.

Adds a folder as a snapshot source and optionally starts its first snapshot. Shows what will be stored, a size estimate and the effective policy before anything is saved.

## Layout

```text
Snapshots / New snapshot
New snapshot
Choose a folder to back up. Kopia keeps snapshotting it according to its policy.

┌──────────────────────────────────────────────────────────────┐ max 860 px
│ Folder to back up                                            │
│ Pick a suggestion, type a path on the server's computer …    │
│ [📁 /home/me/Documents                               ⟳]      │
│ Snapshots will be stored as  [me@pc:/home/me/Documents]      │
│                                                              │
│ [🖩 Estimate size]          [Add without snapshot] [▶ Snapshot now]│
│ ┌ Estimate ──────────────────────────────────────── [✕ Cancel]┐ │
│ │ SIZE 1.2 GB   FILES 3,401   FOLDERS 210   ERRORS 0         │ │
│ └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
┌ Policy ───────────────────────────────────── Edit policy ↗ ┐
│ Schedule     every 1 h                                      │
│ Keeps        10 latest, 48 hourly, 7 daily, …               │
│ Compression  none                                           │
│ Ignores      nothing                                        │
│ Next runs    in 12 minutes · in 1 hour · in 2 hours         │
│ Inherited from the global and host policies unless …       │
└─────────────────────────────────────────────────────────────┘
>_ kopia snapshot create /home/me/Documents
```

Breadcrumb “Snapshots” (link) / “New snapshot”. Title “New snapshot”, description “Choose a folder to back up. Kopia keeps snapshotting it according to its policy.” Content max 860 px wide.

## Path field

A path input with suggestions ([fields.md](../fields.md#path-field)). Label “Folder to back up”. Placeholder: `e.g. C:\Users\me\Documents` on Windows, `e.g. /home/me/Documents` elsewhere. Focused on open.

Suggestions under “Common locations”: `~`, `~/Documents`, `~/Desktop`, `~/Pictures`, `~/Music`, `~/Videos`, `~/Downloads`, each resolved to an absolute path by `POST paths/resolve`. Locations that fail to resolve are left out. The first one (home) gets a home icon.

## Resolution pipeline

Everything below runs automatically as the user types:

1. **Debounce** the trimmed path by 400 ms.
2. **Resolve**: `POST paths/resolve {path}` → `source` (`userName`, `host`, absolute `path`). While the path is changing or resolving, a small spinner sits at the right of the field.
3. When resolved and the path has settled:
   - Show “Snapshots will be stored as” followed by a badge `{user}@{host}:{path}`.
   - Load the folder's **own** policy: `GET policy?…`. `NOT_FOUND` means `{}`.
   - Load `GET sources` to check whether this folder is **already backed up** (same owner and path).
   - Once the policy is loaded, preview it: `POST policy/resolve?… {updates: <own policy>, numUpcomingSnapshotTimes: 3}`.
4. Resolve failure: the server message in red under the field.

**Ready** = resolved, path settled, own policy loaded. The three action buttons are disabled until ready.

## Actions

| Button                                                              | Shown                           | Action                                                                                                                                                                               |
| ------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| “Estimate size” (default, `IconCalculator`, left)                   | always                          | `POST estimate {root: path, maxExamplesPerBucket: 10, policyOverride: <own policy>}` → task. Shows the estimate panel. Spinner while starting.                                       |
| “Add without snapshot” (default)                                    | only when not already backed up | `POST sources {path, createSnapshot: false, policy: <own policy>}`                                                                                                                   |
| “Snapshot now” (primary, `IconPlayerPlay`, also Enter in the field) | always                          | Not backed up yet: `POST sources {path, createSnapshot: true, policy: <own policy>}`. Already backed up: `POST sources/upload?…` (never re-create, that would overwrite its policy). |

While either submit runs, both submit buttons are disabled and the clicked one shows a spinner.

On success: green toast titled “Snapshot started” or “Folder added”, message = the path; navigate to `snapshots`.

On failure: red alert above the buttons, title “Something went wrong”. Message: “This folder does not exist on the server's computer.” for `PATH_NOT_FOUND`, otherwise the server message. The alert clears on the next attempt.

When the folder is already backed up, a blue info alert says: “This folder is already being backed up. “Snapshot now” starts a new snapshot with its existing policy.”

## Estimate panel

Appears below the buttons (tinted card) for the estimate task, as long as the path still matches the estimated path. Polls `GET tasks/{id}` every 0.5 s until it ends.

- Header: spinner + “Estimating…” while running; then “Estimate”, “Estimate canceled” or “Estimate failed”.
- “Cancel” (red subtle, `IconX`) while running → `POST tasks/{id}/cancel`.
- Four stats (2 per row on narrow widths), each: uppercase label, bold value, optional dimmed hint. The values come from the task's counters, whose names the server defines (`internal/server/api_estimate.go`):

| Label   | Value             | Hint (only if non-zero)               |
| ------- | ----------------- | ------------------------------------- |
| Size    | `Bytes` formatted | “{Excluded Bytes formatted} excluded” |
| Files   | `Files`           | “{Excluded Files} excluded”           |
| Folders | `Directories`     | “{Excluded Directories} excluded”     |
| Errors  | `Errors`          | “{Ignored Errors} ignored”            |

- `FAILED` with an `errorMessage`: the message in red.
- If the task can't be loaded: red alert with the message.

## Policy preview card

Shown when resolved, settled and the preview has loaded.

- Title “Policy”; link “Edit policy” with an external-link icon → `policies/edit` for this folder.
- Rows (label column 100 px, dimmed):

| Label       | Value (from `effective`)                                                                                                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule    | `scheduleSummary`: “every {n} h” if `intervalSeconds` is a whole number of hours, else “every {n} min”; then “at HH:MM, HH:MM” for `timeOfDay`; then “cron” if any cron expressions; joined by spaces; “manual only” if none. |
| Keeps       | `retentionSummary`: “{n} latest, {n} hourly, {n} daily, {n} weekly, {n} monthly, {n} annual” (only set, non-zero values); “keep everything” if none.                                                                          |
| Compression | `compression.compressorName`, or “none”.                                                                                                                                                                                      |
| Ignores     | `files.ignore` joined by “, ”, or “nothing”.                                                                                                                                                                                  |
| Next runs   | Only when there are upcoming times: their relative times joined by “ · ”.                                                                                                                                                     |

- Footer: “Inherited from the global and host policies unless this folder has its own.”
- If loading the own policy fails: red alert with the message.

CLI equivalent (once resolved): `snapshot create {path}`, with the path quoted by `q`.
