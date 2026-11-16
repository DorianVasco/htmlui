# Source detail

Navigation ID `snapshots/single-source` with a source (`userName`, `host`, `path`). Source: `src/app/pages/source/SourceDetailPage.tsx`, `SnapshotBrowser.tsx`, `RestoreModal.tsx`, `SnapshotEditModal.tsx`.

Snapshot history of one folder: stats, list of snapshots with retention reasons and pins, browsing files, restoring, editing descriptions and pins, deleting.

## Data

| Call                                                     | When                                                 |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `GET snapshots?userName&host&path[&all=1]`               | On open and when “Show identical” changes            |
| `GET sources`                                            | Polled every 3 s (to find this source's live status) |
| `POST sources/upload` / `POST sources/cancel`            | Header buttons                                       |
| `POST snapshots/delete`                                  | Delete selected / delete source                      |
| `POST snapshots/edit`                                    | Description, add/rename/remove pin                   |
| `GET objects/{oid}`                                      | Snapshot browser (folders) and downloads (files)     |
| `GET mounts/{oid}`, `POST mounts`, `DELETE mounts/{oid}` | Mount controls in the browser                        |
| `POST restore`                                           | Restore dialog                                       |

If the path parameter is missing, the screen shows only a red alert “No source selected” with a link “Back to snapshots”.

## Layout

```text
Snapshots / me@pc
/home/me/Documents                        [🛡 Policy] [▶ Snapshot now] [⋯]
Snapshots of me@pc

┌ SNAPSHOTS ┐ ┌ LATEST SIZE ┐ ┌ LAST RUN ────┐
│ 24        │ │ 1.2 GB      │ │ 2 hours ago  │
│ 2 pinned …│ │ 3,401 files │ │ next in 1 h  │
└───────────┘ └─────────────┘ └──────────────┘

┌ History ───────────────────────────── (○ Show identical) [🗑 Delete 2] ┐
│ ☐  Started                              Retention        Size   Files   │
│ ☐  15/11/2026, 10:00  📌do-not-delete✕  latest-1 daily-1 1.2 GB 3,401 📂↺⋯│
│    2 hours ago                                                          │
└─────────────────────────────────────────────────────────────────────────┘
>_ kopia snapshot list me@pc:/home/me/Documents
```

### Header

- Breadcrumb “Snapshots” (link) / `{user}@{host}`.
- Title: the path. Description “Snapshots of {user}@{host}”.
- Actions:
  - “Policy” (default, `IconShieldCheck`) → `policies/edit` for this source.
  - Only when the source appears in `GET sources`:
    - If `isActive`: “Stop” (red light, `IconPlayerStop`) → `POST sources/cancel`.
    - Otherwise “Snapshot now” (primary, `IconPlayerPlay`) → `POST sources/upload`.
    - Spinner while running; then refetch sources. Failure → red toast “Could not stop snapshot” / “Could not start snapshot”.
  - “More actions” menu: “Delete source and all snapshots…” (red, `IconTrash`) → delete-source confirmation.

### Stat cards (3 in a row)

“Latest” = the newest snapshot without `incomplete`.

| Label       | Value                                         | Hint                                                                                                                                                               |
| ----------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Snapshots   | number of listed snapshots, “—” while loading | parts joined by “ · ”: “{n} pinned” (snapshots with any pin), “{n} hidden” (`unfilteredCount − listed`, only while “Show identical” is off); no hint if both are 0 |
| Latest size | size of latest, or “—”                        | “{files} files”                                                                                                                                                    |
| Last run    | `relativeTime` of latest start, or “never”    | “next {relative next time}” if the source has `nextSnapshotTime`; “manual schedule” if the source is known but has none; nothing otherwise                         |

### History table

Card with toolbar: title “History”; switch “Show identical” (tooltip “Also show snapshots that are identical to a newer one”) which reloads with `all=1`; red light button “Delete” / “Delete {n}” (`IconTrash`), disabled when nothing is selected.

Rows are sorted newest first by `startTime`. Minimum width 720 px.

| Column              | Content                                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☐ (40 px)           | Selection checkbox, accessible name “Select snapshot from {absolute time}”. Header checkbox “Select all snapshots” (checked if all selected, indeterminate if some, disabled if empty). Selected rows are tinted.                      |
| Started             | Line 1: absolute start time as a link (opens the browser), then pin badges, an “incomplete” badge, an error badge. Line 2 (dimmed): the description, or the relative start time if there is none.                                      |
| Retention           | One small badge per `retention` reason, colored by `retentionColor` (latest teal, hourly cyan, daily blue, weekly indigo, monthly grape, anything else pink).                                                                          |
| Size (right, mono)  | `summary.size` formatted, or empty                                                                                                                                                                                                     |
| Files (right, mono) | `summary.files` with separators, or empty                                                                                                                                                                                              |
| actions (120 px)    | “Browse files” (`IconFolderOpen`) → browser; “Restore…” (`IconRestore`) → restore dialog for the whole snapshot; menu “More snapshot actions” with “Add description…” / “Edit description…” (`IconPencil`) and “Add pin…” (`IconPin`). |

- **Pin badge**: orange light badge with a pin icon and the pin name, plus a small “unpin” button (`IconPinnedOff`, accessible name “Remove pin {pin}”). Clicking the badge (not the button) opens “Rename pin” (tooltip “Click to rename”). Clicking unpin calls `POST snapshots/edit {snapshots:[id], removePins:[pin]}` right away and reloads. Failure → red toast “Could not remove pin”.
- **“incomplete” badge**: small yellow, tooltip = the `incomplete` reason.
- **Error badge**: as on the dashboard, from `summary.numFailed` and `summary.errors`.
- Selections that disappear from the list (deleted, or hidden again) are dropped.

States: spinner while loading; red alert “Could not load snapshots” if loading failed with no data; “No snapshots yet.” as a centered dimmed row if the list is empty.

CLI equivalent: `snapshot list {q(user@host:path)}`, plus ` --show-identical` when the switch is on.

## Delete confirmation

|       | Delete selected                                                                                                                                 | Delete source                                                                                                               |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Title | “Delete snapshot?” or “Delete {n} snapshots?”                                                                                                   | “Delete this source?”                                                                                                       |
| Text  | “The selected snapshot is deleted from the repository.” / “The selected snapshots are deleted from the repository.” + “ This cannot be undone.” | “All snapshots of this folder and its policy will be deleted. Kopia will no longer back it up.” + “ This cannot be undone.” |
| Call  | `POST snapshots/delete {source, snapshotManifestIds}`                                                                                           | `POST snapshots/delete {source, deleteSourceAndPolicy: true}`                                                               |
| After | Clear selection, reload list                                                                                                                    | Green toast “Deleted {path} and its snapshots.”, navigate to `snapshots`                                                    |

Buttons “Cancel” and red “Delete” (`IconTrash`, spinner while running). Failure → red toast “Could not delete”; the dialog closes.

## Snapshot edit dialog

One dialog for three edits. It opens with the current value and shows “Snapshot from {absolute time}” (dimmed) at the top.

| Edit        | Title                  | Field                                                                                                                 | Initial             | Submit label |
| ----------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------ |
| Description | “Snapshot description” | Textarea “Description”, help “Shown in the history instead of the time since the snapshot. Leave empty to remove it.” | current description | “Save”       |
| Add pin     | “Pin snapshot”         | Text “Pin name”, help “Pinned snapshots are kept even when the retention rules would delete them.”                    | `do-not-delete`     | “Pin”        |
| Rename pin  | “Rename pin”           | same                                                                                                                  | the pin             | “Save”       |

- Submit is disabled while the trimmed value equals the initial value, except for “Add pin” (so the default name can be submitted directly).
- Validation for pins: empty → “Enter a name for the pin.”; a different name the snapshot already has → “This snapshot already has that pin.” Typing clears the error.
- Calls: description → `POST snapshots/edit {snapshots:[id], description: trimmed}` (empty string removes it). Pin → `{snapshots:[id], addPins:[new], removePins: [old] if renamed}`.
- Success: reload list, close. Failure: red alert inside the dialog with the message.

## Snapshot browser

Drawer, title “Browse snapshot”, opened from the start-time link or “Browse files”.

```text
Browse snapshot                                                       ✕
15/11/2026, 10:00:00 · k3f9a1c2b7d0
[↺ Restore all…]  [📂 Mount as folder]
(root) / Documents / Taxes
📁 2025                         14/03/2026, 09:12       12.4 MB  ↺
📄 receipt.pdf                  02/02/2026, 18:40       230 KB   ⬇
>_ kopia ls -l k8c1…
```

- Subtitle: absolute start time · first 12 characters of the snapshot ID (monospace).
- **Restore button**: “Restore all…” at the root, “Restore this folder…” inside a folder. Opens the restore dialog for the current folder.
- **Mount controls** (always for the snapshot root, see below).
- **Breadcrumbs**: “(root)”, then each folder opened. Every crumb but the last is a link back to that level.
- **Listing**: `GET objects/{current oid}`, entries sorted by `sortEntries` (folders first, then name). Minimum width 420 px.
  - Name with icon: folder (yellow) or file. Clicking a folder row opens it.
  - Modified time (`mtime`, absolute, dimmed); hidden on narrow widths.
  - Size (right, mono, dimmed): folders use `summ.size`, files `size`.
  - Actions: files get “Download” (`IconDownload`, accessible name “Download {name}”); folders get “Restore…” (`IconRestore`, accessible name “Restore {name}”). See divergence D4: files can't be restored individually.
- Download: `GET objects/{oid}?fname={name}`. Native: ask for a save location with the OS dialog, then stream the response to that file.
- Empty folder: “This folder is empty.” Loading: spinner. Failure: red alert “Could not open folder”.
- CLI equivalent: `ls -l {current oid}`.

When restore is chosen inside the browser, the drawer closes and the restore dialog opens with:

- Title: “Restore “{name}” from {absolute time}” for a sub-folder, “Restore snapshot from {absolute time}” for the root.
- Default destination: `{source path} (restored)` joined with the folder's path inside the snapshot, using the separator the source path uses (`\` if the source path contains one, else `/`).

### Mount controls

`GET mounts/{root oid}` tells whether it is mounted. A `404` means not mounted and is not shown as an error.

- Not mounted: default button “Mount as folder” (`IconFolderOpen`) → `POST mounts {root}`.
- Mounted: read-only field (accessible name “Mounted at”) with the path and a copy button, then “Open in file manager” (`IconExternalLink`; web: KopiaUI only, native: always, opens Explorer/Finder), then “Unmount” → `DELETE mounts/{oid}`.
- Failure → red toast “Could not mount snapshot” / “Could not unmount snapshot”.

## Restore dialog

Title “Restore {what}” (`what` = “snapshot from {absolute time}” or ““{name}” from {absolute time}”). Wide modal.

| Field                                                                                        | Default         | Notes                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Restore to” (text, folder icon)                                                             | from the caller | Help: “A folder on the server's computer. End the name with .zip or .tar to create an archive instead.” Empty on submit → error “Enter where to restore to.” Native: add a “Browse…” button with the folder picker. |
| “Overwrite existing files”                                                                   | off             | Hidden when the destination ends in .zip/.tar (case-insensitive)                                                                                                                                                    |
| “Restore modification times”                                                                 | on              | hidden for archives                                                                                                                                                                                                 |
| “Restore permissions”                                                                        | on              | hidden for archives                                                                                                                                                                                                 |
| “Restore owners”                                                                             | on              | hidden for archives                                                                                                                                                                                                 |
| “More options” (collapsed by default, chevron)                                               |                 |                                                                                                                                                                                                                     |
| ↳ “Continue on errors”, help “Skip files that can't be restored instead of stopping.”        | off             |                                                                                                                                                                                                                     |
| ↳ “Skip files restored before”, help “Resume an interrupted restore into the same location.” | on              |                                                                                                                                                                                                                     |

“Start restore” (primary, `IconRestore`) builds the request with `restoreRequest` and calls `POST restore`. On success the dialog closes and a blue toast appears: title “Restore started”, message “Restoring to {destination}.” with a link “Show progress” → `tasks/{id}`. On failure the message shows as the field's error. “Cancel” closes. The form resets every time the dialog opens.
