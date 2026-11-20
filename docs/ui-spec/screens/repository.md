# Repository

Navigation ID `repo` (optional `switch={knownRepoId}`). Source: `src/app/pages/repository/*.tsx`, `src/app/knownRepos.ts`, `src/app/storageErrors.ts`.

Shows the connected repository, or the setup wizard when there is none, plus the list of known repositories for switching.

> **Native repository model.** The web UI talks to one server and switches repositories by disconnecting and reconnecting it, remembering filesystem repositories in browser storage and asking for the password on every switch. Native clients run one server per repository config ([design doc §3.1](../../native-clients-design.md#31-process-model)), so switching works differently. The screen layout below still applies; the differences are in [native-only.md](../native-only.md#repository-model).

## Which layout

Gate checks first (spinner / server unreachable / “Opening repository…”, as in [shell.md](../shell.md#connection-gate)), then:

| Condition                                  | Layout                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Connected and not adding                   | **Connected** layout, then the **Repositories** list                                           |
| Connected and “Add repository” was clicked | Header “Add a repository” with “Back to current repository” (`IconArrowLeft`), then the wizard |
| Not connected                              | Header “Set up a repository”, then “Recent repositories” (if any), then the wizard             |

Header description in the last two cases: “Create a new repository or connect to an existing one.”

## Connected layout

Header: title “Repository”, description “Where your snapshots are stored.”, red light button “Disconnect” (`IconPlugConnectedX`).

Left card (one third):

- Database icon, dot badge “Connected” (green) and, if read-only, yellow badge “Read-only”.
- Text field “Description” (initially the server's description) and default button “Save description”, enabled only when the text differs. Calls `POST repo/description`; also renames the matching known repository; refreshes the status. Success → green toast “Description saved”. Failure → red toast “Could not save description”.

Right card (two thirds): a key/value table (labels dimmed, 170 px; values monospace, wrap anywhere). Rows with empty values are left out:

| Label            | Value                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Config file      | `configFile`                                                                                   |
| Storage          | `storage`. Replaced by **Server** = `apiServerURL` when connected through a repository server. |
| Encryption       | `encryption`                                                                                   |
| Hash             | `hash`                                                                                         |
| Splitter         | `splitter`                                                                                     |
| Format version   | `formatVersion`                                                                                |
| Error correction | “{ecc} ({eccOverheadPercent}%)”, or “disabled” when the percentage is 0                        |
| Connected as     | “{username}@{hostname}”                                                                        |

### Network limits card

Below the details: a card with `IconGauge`, title “Network limits” and a summary, plus a default button “Edit…”. Loads `GET repo/throttle` once.

- Summary: “No limits: Kopia uses the full connection speed.” when nothing is set; otherwise “Upload {rate} · Download {rate}”, plus “· {n} more limit(s)” when advanced limits are set. A rate is “unlimited” or e.g. “5 MB/s” (MB/s from 1 MB/s on, else KB/s; KiB/MiB with the base-2 Sizes preference).
- `STORAGE_CONNECTION` (repository reached through a Kopia server): summary “Not available for repositories on a Kopia server.”, button disabled. Other load errors: “Could not load the limits: {message}”, button disabled.

**Edit dialog**, title “Network limits – {description}”: text “Leave a field empty for no limit. Changes apply right away, also to snapshots that are running, and are kept after a restart.” Fields as in [native-only.md](../native-only.md#throttling-dialog): upload and download limit (number + unit select KB/s or MB/s), and under a collapsible “Advanced” (open when any advanced limit is set) reads/writes/lists per second and concurrent reads/writes. Buttons: subtle “Remove all limits” (clears every field; disabled when nothing is set), “Cancel”, “Save”. Save sends `PUT repo/throttle` with only the positive values (empty object = no limits), shows the green toast “Network limits saved” and reloads the summary; a failure shows a red alert “Could not save the limits” in the dialog.

CLI equivalent: `repository status`.

**Disconnect** confirmation: title “Disconnect from repository?”, text “This computer stops making snapshots until it is connected again. The repository and its snapshots are **not** deleted, and it stays in your repository list.”, buttons “Cancel” / red “Disconnect”. Calls `POST repo/disconnect`, clears the active known repository, refreshes the status (the screen then shows the setup layout). Failure → red toast “Could not disconnect”.

### Repositories list (connected)

Title “Repositories”, help “Switch between repositories you used in this browser. The server is connected to one at a time.”, light button “Add repository” (`IconPlus`). Then the known-repositories list with action “Switch”, or, if empty, “Repositories you create or connect from here will be listed for quick switching.”

## Known repositories list

One row per known repository (newest `lastConnected` first):

- Folder icon; description (or “Unnamed repository”) in bold; badges “Current” (green) and “Read-only” (yellow) when they apply.
- Path (dimmed, wraps anywhere).
- “as {user}@{host} · last used {relative time}” (dimmed).
- Right: light button “Switch” / “Connect” (not for the current one) → switch dialog; trash icon “Forget” (tooltip “Forget (removes it from this list only)”) removes it from the list immediately, no confirmation.

“Current” = the active known repository, but only while the server is connected and its `storage` type matches (`useCurrentKnownRepo`).

## Switch repository dialog

Opened from a list row or from the header menu (`repo?switch={id}`). Title “Switch to “{description or path}””.

- Path (dimmed).
- While connected (and no earlier failure): blue info “The server is disconnected from **{current description}** first. Scheduled snapshots only run for the connected repository.” (“the current repository” if unknown).
- Password field “Repository password” (required, focused).
- Buttons “Cancel” and primary “Switch” (while connected) / “Connect”. Primary is disabled while the password is empty.
- Submit: if connected, `POST repo/disconnect` and clear the active repository; then `POST repo/connect {storage, password, clientOptions: {…saved options, description}}`. On success remember the repository (moves it to the top, marks it active), refresh the status, green toast “Switched repository” with the description or path, close, navigate to `snapshots`.
- Failure: red alert with `INVALID_PASSWORD` → “The password is not correct for this repository.”, `NOT_INITIALIZED` → “There is no repository at this location anymore.”, otherwise “{message} ({code})” or the message. If the server was disconnected first, add “The server is now not connected to any repository. Try again or pick another one.” and the primary button becomes “Connect”.
- Closing clears the password and errors. Closing removes the `switch` parameter.

## Setup wizard

A three-step stepper in a card (max 860 px). Steps can only be revisited backwards by clicking a completed step; errors reset when the step changes.

| Step | Label                      | Description           |
| ---- | -------------------------- | --------------------- |
| 1    | Storage                    | Where to keep backups |
| 2    | Location                   | Directory path        |
| 3    | Create / Connect (by mode) | Password and options  |

### Step 1: Storage

Text: “Choose where the repository lives. Kopia encrypts everything before it is written there.” Then a two-column grid of storage cards (label + description):

| ID           | Label                   | Description                                                      |
| ------------ | ----------------------- | ---------------------------------------------------------------- |
| `filesystem` | Local directory or NAS  | A folder on this computer, an external drive or a network share. |
| `s3`         | Amazon S3 or compatible | AWS S3, MinIO, Wasabi, Cloudflare R2 and others.                 |
| `b2`         | Backblaze B2            | Backblaze B2 cloud storage.                                      |
| `gcs`        | Google Cloud Storage    | A Google Cloud Storage bucket.                                   |
| `azureBlob`  | Azure Blob Storage      | A Microsoft Azure storage container.                             |
| `sftp`       | SFTP server             | Any server reachable over SSH/SFTP.                              |
| `webdav`     | WebDAV server           | Nextcloud, ownCloud and other WebDAV servers.                    |
| `rclone`     | Rclone remote           | Any backend supported by rclone.                                 |
| `_server`    | Kopia repository server | A repository shared by a Kopia server.                           |
| `_token`     | Repository token        | Connect using a token from another Kopia client.                 |

Every card is a button: clicking selects the type (highlighted border) and goes to step 2. Step 2 shows the directory field for `filesystem` and the type's form for all others ([fields.md](../fields.md#storage-forms)); the differences in steps 2 and 3 are listed in [native-only.md](../native-only.md#other-storage-types), which the web UI follows too.

## Step 2: Location (filesystem)

Path field “Directory” (required, focused). Help: “An existing repository is detected automatically; an empty or new folder creates a new one.” Placeholder `e.g. D:\Backups\kopia` (Windows) or `e.g. /mnt/backup/kopia`. Suggestions: “Recently used” = known filesystem repositories (path, with the description as caption); “Common locations” = `~/kopia-repository`, `~` resolved by the server.

“Back” / primary “Continue”. Continue:

1. Empty → error “Enter the directory where the repository is or should be stored.”
2. Resolve the path with `POST paths/resolve` (expands `~`). On failure keep the typed path. The field is updated to the resolved path.
3. `POST repo/exists {storage: {type, config: {path}}}`:
   - Success → mode **connect**.
   - `NOT_INITIALIZED` → mode **create**.
   - A missing directory (`isMissingDirectory`) → mode **create**, “folder missing” (the server creates it).
   - Anything else → red alert “Something went wrong” with `errorText` (below).
4. Go to step 3. Spinner on Continue while checking.

### Step 3: Create or connect

Top alert:

- Create: blue, title “A new repository will be created”, text “in **{path}**[ (the folder will be created)]. Choose a strong password – it encrypts your backups and **cannot be recovered** if lost.”
- Connect: green, title “Existing repository found”, text “in **{path}**. Enter its password to connect.”

Fields ([fields.md](../fields.md#setup-wizard)): “Repository password” (and “Confirm password” when creating, side by side), “Description” (default “My Repository”, help “Shown in the header to tell repositories apart.”), and two collapsible sections:

- “Identity of this computer”: “Username” and “Hostname” (default from `GET current-user`), the line “Snapshots made from here are owned by {user}@{host}.”, and for connect only, switch “Connect read-only”.
- “Encryption and format” (create only): encryption, hash, splitter, error-correction overhead, error-correction algorithm, legacy format. Options come from `GET repo/algorithms`.

If the server is connected to another repository, a yellow alert: “The server will disconnect from **{current description or “the current repository”}** first – a Kopia server holds one repository at a time. You can switch back from the repository list.”

Buttons “Back” (disabled while submitting) and primary “Create repository” / “Connect”.

Submit:

1. Mark fields touched. Missing password → “Enter a password”. Create with mismatched confirmation → “Passwords don't match”. Stop if invalid.
2. If connected: `POST repo/disconnect`, clear the active repository.
3. `POST repo/create` or `POST repo/connect` with `storage`, `password`, `clientOptions {description, username, hostname, readonly}`, and for create `options` (block format with the chosen or default algorithms; `version: 1` only for legacy format; object format splitter).
4. Remember the repository if it is a filesystem one (`rememberableStorage`), refresh the status, green toast “Repository created” (“New repository in {path}”) or “Connected” (“Connected to the repository in {path}”), navigate to `snapshots`.
5. Failure: red alert “Something went wrong” with `errorText`; if step 2 had disconnected, append “ The server is now not connected to any repository.”

`errorText` (setup wizard):

| Code                | Text                                                                             |
| ------------------- | -------------------------------------------------------------------------------- |
| INVALID_PASSWORD    | The password is not correct for this repository.                                 |
| ALREADY_CONNECTED   | The server is already connected to a repository. Disconnect it first.            |
| ALREADY_INITIALIZED | A repository already exists at this location. Go back and connect to it instead. |
| STORAGE_CONNECTION  | Cannot access the storage: {message}                                             |
| other code          | {message} ({code})                                                               |
| no code             | {message}                                                                        |
