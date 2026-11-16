# Policies

Navigation IDs `policies` and `policies/edit` (with a policy target). Source: `src/app/pages/policies/PoliciesPage.tsx`, `PolicyEditor.tsx`, `PolicyFields.tsx`, `policyModel.ts`.

Lists every policy and edits one at a time in a side panel. Policies inherit: folder → user → computer (host) → global.

## Policy targets

A target is (`userName`, `host`, `path`), with empty strings for unused parts. Its kind (`policyKind`):

| Kind      | userName | host | path | Badge label | Badge color | Display label (`targetLabel`) |
| --------- | -------- | ---- | ---- | ----------- | ----------- | ----------------------------- |
| global    | ""       | ""   | ""   | Global      | teal        | “Global policy”               |
| host      | ""       | set  | ""   | Computer    | blue        | “@{host}”                     |
| user      | set      | set  | ""   | User        | indigo      | “{user}@{host}”               |
| directory | set      | set  | set  | Folder      | grape       | the path                      |

## List

Header: title “Policies”, description “Schedules, retention and file rules. A folder's policy overrides its user's, which overrides the computer's and the global policy.”, primary button “New policy” (`IconPlus`).

Toolbar:

- Search field (placeholder “Search”, accessible name “Search policies”, up to 360 px). Matches the display label, user name or host (case-insensitive substring).
- Segmented control (accessible name “Show policies of”): “This computer” (default) / “All”.
  - “This computer” keeps the global policy, host policies for the local host, and user/folder policies of the local user on the local host. Local user and host come from `GET sources`.

Sort (`filterPolicies`): global, computer, user, folder; then by display label.

Table (min width 600 px, rows clickable → open editor):

| Column        | Content                                                                                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type (120 px) | Kind badge                                                                                                                                                                                                                                         |
| Applies to    | Display label (bold, wraps anywhere); for folders, `{user}@{host}` dimmed below                                                                                                                                                                    |
| Defines       | One neutral badge per defined section (`definedSections`): Retention, Schedule, Files, Errors, Compression, Metadata compression, Splitter, Upload, Actions, Logging, OS snapshots, plus “No inheritance” if `noParent`. Dimmed “nothing” if none. |

States: spinner while loading; red alert “Could not load policies”; empty row “No policies yet.” or, when filtered out, “No policies match.”

Data: `GET policies` once (refetched after the editor saves or deletes), `GET sources` (polled).

CLI equivalent: `policy list`.

### New policy dialog

Title “New policy”. One field “Applies to”:

- Help: “A folder path (for {user}@{host}), `user@computer` for all folders of a user, or `@computer` for everything on a computer.”
- Placeholder: `e.g. C:\Data or @{host}` (or `e.g. /home/me/Documents` if the host is unknown). Native: choose the example by OS.
- Parsed with `parsePolicyTarget` on submit. Errors show under the field and clear on typing.
- “Continue” opens the editor for the target (new or existing). “Cancel” closes.

## Editor

Opens as a drawer (title “Policy”) over the list. Closing navigates back to `policies`.

### Loading

`GET policy?…` for the target. `NOT_FOUND` means a **new** policy (empty definition). Other errors: red alert “Could not load policy”. Spinner while loading.

### Header

- Kind badge, plus an outline “New” badge for new policies.
- Title: display label. For folders, `{user}@{host}` dimmed below.
- Help: “Empty fields are inherited from broader policies. Under each field you see the value in effect and where it comes from.”
- If the preview fails: yellow alert “Could not preview the effective policy: {message}”.

### Live preview

The editor holds the edited definition. 300 ms after every change it calls `POST policy/resolve?… {updates: cleanPolicy(definition), numUpcomingSnapshotTimes: 5}` (canceling the previous call). The response drives:

- **“Effective” lines** under every field: “Effective: {value} · set here” or “Effective: {value} · from {link to the defining policy}”. Value formatting: “not set” for missing, “yes”/“no” for booleans, lists joined by “, ” (times of day as HH:MM, empty list “none”), field-specific formats where stated in [fields.md](../fields.md#policy-editor). The source is `definition` at the same path; “set here” when it equals this target (`sameTarget`).
- **Upcoming snapshots** box on the Schedule tab.

### Tabs

Nine tabs, scrollable horizontally, Schedule selected first: Schedule, Retention, Files, Errors, Compression, Upload, Actions, Logging, Other. Every field is listed in [fields.md](../fields.md#policy-editor). Only the active tab's content exists (no hidden state).

Field types and how they map to the definition:

| Type                    | Control                                                  | Empty / inherit means        |
| ----------------------- | -------------------------------------------------------- | ---------------------------- |
| Number                  | Number input, placeholder “inherit”, min 0, integers     | field removed                |
| Boolean                 | Segmented “Inherit / Yes / No”                           | field removed                |
| Flag (this policy only) | Segmented “No / Yes”                                     | “No” removes the field       |
| Select                  | Dropdown, placeholder “inherit”, clearable               | cleared removes the field    |
| Text                    | Text input                                               | empty removes the field      |
| Tags                    | Tag input (Enter adds)                                   | empty list removes the field |
| Lines                   | Multi-line monospace text, one entry per line, 3–12 rows | empty removes the field      |
| Times of day            | Tag input of HH:MM (Enter, comma or space adds)          | empty removes the field      |

Removing the last field of a section removes the section (`setPath`). **Upcoming snapshots** box (Schedule tab): title “Upcoming snapshots”; the `schedulingError` in red, or the upcoming times as “{absolute} ({relative})” joined by “ · ”, or “None scheduled.”

The **Other** tab also shows the cleaned definition as formatted JSON (read-only, small monospace), titled “JSON”.

### Footer

- Left: “Delete policy” (red subtle), only for existing, non-global policies. Opens a confirmation: title “Delete policy?”, text “The policy for {label} is removed. Its settings then come from broader policies again.”, buttons “Cancel” / red “Delete”. Calls `DELETE policy?…`.
- Right: “Cancel” (closes, discarding edits) and primary “Create policy” (new) / “Save” (existing). Save is disabled for existing policies until `cleanPolicy(edited) ≠ cleanPolicy(loaded)`. Calls `PUT policy?…` with `cleanPolicy(edited)`.
- After save/delete: green toast “Saved policy for {label}.” / “Deleted policy for {label}.”, refresh the list, close. Failure: red toast “Could not save policy” / “Could not delete policy”; the editor stays open.
- No unsaved-changes prompt when closing. Native: add one (“Discard changes?”) since closing a pane is easier to do by accident.

CLI equivalent (above the footer): `policy show {cliPolicyTarget}`.
