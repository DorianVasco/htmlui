# Native-only behaviour

> **New design, not derived from code.** Everything in this file is behaviour the web UI doesn't have, or has differently because it runs in a browser. It was designed for the native clients from [the design doc](../native-clients-design.md) and the [API guide](../api/README.md). Review it like any new design; don't assume the web UI already does it.

## Repository model

The web UI has one server and switches repositories by disconnecting and reconnecting it. Native clients run **one `kopia server` per repository config file** (`%APPDATA%\kopia\<id>.config` or `~/Library/Application Support/kopia/<id>.config`; the first is named `repository`, matching KopiaUI and the CLI).

| Concern              | Web UI                                                              | Native                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| List of repositories | Known repositories in `localStorage`, filesystem only, no passwords | The config files in the config directory. Every storage type. Description from each config (`clientOptions.description`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Current repository   | The one the single server is connected to                           | The one whose window is showing. Several servers can run at once.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Switching            | Password dialog, disconnect, connect                                | Pick another repository in the header menu. Its server starts (if not running) and opens the repository from its config file, using the password Kopia saved at connect time (OS keyring or config). No password prompt in the normal case. **Open question:** if the saved password is missing or wrong, `kopia server start --async-repo-connect` keeps retrying (`initTaskID` stays set) and the API has no call that reopens an existing config with only a password. Until that is solved, show “Kopia can't open this repository. Reconnect it from the setup wizard.” after the first failed attempt. |
| Scheduled snapshots  | Only for the connected repository                                   | For **every** repository whose server runs. Running servers keep snapshotting while the window shows another repository.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Add repository       | Setup wizard; disconnects the current one first                     | First start a new server for a **new config path** (`repository-{timestamp}.config`, as KopiaUI names them). It runs not connected, which the wizard needs anyway: steps 2 and 3 call `paths/resolve`, `repo/exists`, `repo/algorithms` and `current-user` on that server. Create/connect then writes the config file. The current repository and its server are untouched, so drop the yellow “will disconnect … first” alert. If the wizard is canceled, stop the new server; no file was written.                                                                                                         |
| Disconnect           | `POST repo/disconnect`                                              | `POST repo/disconnect` on that repository's server. The server deletes the config file, its cache directory and maintenance lock (`repo.Disconnect`). Then stop the server and remove the entry from the list, except the default `repository` entry, which stays listed as “Not connected” so the user can set it up again (KopiaUI's `deleteConfigIfDisconnected`). Confirmation text: “This computer stops making snapshots into this repository. The repository and its snapshots are not deleted. You can connect to it again later.”                                                                   |
| “Forget”             | Removes from the browser list                                       | Not needed: the list is the set of config files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Header menu          | “Manage repositories” + known repositories                          | Same, listing config files. Each item shows a small status dot (running / starting / stopped / error).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

The Repository screen keeps its layout. Rename the list's help text to “Repositories on this computer. Each one keeps its own schedule.” and the action to “Open”.

## Server states

Each repository has a server process ([design doc §3.2](../native-clients-design.md#32-server-launch-contract)). Its state replaces the web UI's “Cannot reach the Kopia server” panel in the connection gate:

| Server state                                   | Gate shows                                                                                       | Tray / header dot                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Stopped                                        | “Kopia is not running for this repository.” + button “Start”                                     | gray                                                                               |
| Starting (no address/password/fingerprint yet) | spinner + “Starting Kopia…”                                                                      | gray, pulsing                                                                      |
| Running, `initTaskID` set                      | spinner + “Opening repository…” (as web)                                                         | blue, pulsing                                                                      |
| Running, connected                             | the screen                                                                                       | green; orange if any source `needsAttention`; blue pulsing while any snapshot runs |
| Running, not connected                         | “Not connected to a repository” panel (as web)                                                   | gray                                                                               |
| Crashed / restarting (backoff)                 | red alert “Kopia stopped unexpectedly. Restarting in {n} s…” + “Restart now” + “Show server log” | red                                                                                |
| Running but not answering                      | web panel “Cannot reach the Kopia server” + “Try again” + “Show server log”                      | red                                                                                |

**Server log**: a read-only monospace view of the last ~1000 stderr/stdout lines, with “Copy” and “Save…”. Reached from the gate, the tray menu and Preferences (“Diagnostics”). Passwords are removed from the lines before display.

## Tray / menu bar

Present whenever the app runs. Closing the main window leaves the app running in the tray; “Quit Kopia” in the tray stops all servers.

Icon state: worst state across all repositories (red > orange > blue-running > green > gray), using the colors above. Tooltip: “Kopia – {summary}”, e.g. “Kopia – 1 snapshot running”, “Kopia – 2 folders need attention”, “Kopia – all backups up to date”.

Menu:

```text
Kopia
───────────────────────────────
My Repository                ●     ← one block per repository
  /home/me/Documents  Protected · 2 hours ago      ▶
  /home/me/Pictures   Uploading 42%                ■
  Back up all now
───────────────────────────────
Pause scheduled snapshots     ▸  1 hour / 8 hours / until resumed
Open Kopia
Launch at login               ✓
───────────────────────────────
Quit Kopia
```

- Source lines use the same `sourceState` labels and colors as the dashboard. Clicking a line opens its source detail. ▶ / ■ start or stop that source.
- Data per repository: `GET control/sources` and `GET control/status` every 5 s (server-control user), independent of window visibility.
- “Back up all now”: `POST control/trigger-snapshot` with no filter (all local sources of that repository).
- **Pause**: `POST control/pause-source` (no filter) on every running server; resume with `POST control/resume-source`, either from the same menu (“Resume scheduled snapshots”) or automatically when the chosen period ends (the app keeps the timer; pausing doesn't survive a restart of the app). Sources then show “Paused”.
- “Open Kopia” brings the window to the front on `snapshots`.

## OS notifications

| Event                                 | Source                                                                            | Title                                 | Body                             | Click opens                  |
| ------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------- | ---------------------------- |
| Server notification                   | `NOTIFICATION:` stderr line (JSON with `subject`, `body`, `severity`)             | its `subject`                         | its `body`, with markup stripped | the repository's `snapshots` |
| Snapshot failed (detected by polling) | a source whose `lastSnapshot` changed and has `numFailed > 0`, or status `FAILED` | “Backup of {folder name} failed”      | “{n} errors. {first error}”      | that source's detail         |
| Server stopped unexpectedly           | server host                                                                       | “Kopia stopped”                       | “Restarting…”                    | the server log               |
| Restore finished / failed             | a restore task started from this app reaching SUCCESS / FAILED                    | “Restore finished” / “Restore failed” | destination / error              | `tasks/{id}`                 |

Severity mapping for server notifications: ≥ 20 error, ≥ 10 warning, else info. Preferences gets a toggle **“Notify when backups succeed”** (default off, stored locally): when off, server notifications below warning are not shown.

## Preferences additions

Add a **“This app”** card above Notifications:

| Label                       | Hint                                                                        | Control                                        | Stored                                   |
| --------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Launch at login             | Start Kopia in the tray when you sign in.                                   | Switch (default off; offered during first run) | OS (StartupTask / SMAppService)          |
| Notify when backups succeed | Show a notification after every successful snapshot, not only for problems. | Switch (default off)                           | locally                                  |
| Show in Dock (macOS)        | Turn off to keep Kopia only in the menu bar.                                | Switch (default on)                            | locally                                  |
| Upload and download limits  | Limit how fast Kopia uses the network for this repository.                  | Button “Edit…” → throttling dialog             | in the repository config (by the server) |
| Diagnostics                 | —                                                                           | Button “Show server log”                       | —                                        |

### Throttling dialog

Title “Network limits – {repository description}”. Loads `GET repo/throttle`. If it fails with `STORAGE_CONNECTION` (repository reached through a Kopia server), the button is disabled with the tooltip “Not available for repositories on a Kopia server”.

| Label             | API field                        | Input                                                                         |
| ----------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| Upload limit      | `maxUploadSpeedBytesPerSecond`   | Number + unit (KB/s, MB/s; base from the Sizes preference); empty = unlimited |
| Download limit    | `maxDownloadSpeedBytesPerSecond` | same                                                                          |
| Reads per second  | `readsPerSecond`                 | number, empty = unlimited (under “Advanced”)                                  |
| Writes per second | `writesPerSecond`                | same                                                                          |
| Lists per second  | `listsPerSecond`                 | same                                                                          |
| Concurrent reads  | `concurrentReads`                | integer                                                                       |
| Concurrent writes | `concurrentWrites`               | integer                                                                       |

Save → `PUT repo/throttle` with only the non-empty fields. Success: green toast “Network limits saved”.

`PUT repo/throttle` applies the limits right away and the server also saves them in the repository's config file (`repo/open.go` registers an update handler that writes `Throttling` to the config), so they survive restarts; the app doesn't need to store or re-apply them. The web UI offers the same dialog on the Repository screen ([screens/repository.md](screens/repository.md#network-limits-card)).

## Other storage types

The setup wizard supports every storage card (the web UI does too). Step 2 shows the type's form instead of the directory field ([fields.md](fields.md#storage-forms)); the rest of the wizard is the same, with these differences:

| Type                                                                                  | Step 2 “Continue”                                                                                                                                          | Step 3                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud and server storage (`s3`, `b2`, `gcs`, `azureBlob`, `sftp`, `webdav`, `rclone`) | Validate required fields, then `POST repo/exists {storage}`: success → connect, `NOT_INITIALIZED` → create, other errors → `errorText`. No path resolving. | Unchanged. The create alert reads “in **{summary}**”, where summary = bucket/container (+ “/prefix”), `user@host:path` for SFTP, the URL for WebDAV, the remote path for rclone. |
| `_server` (Kopia repository server)                                                   | Validate the URL, go straight to connect (no exists check).                                                                                                | Connect only. Request: `{apiServer: {url, serverCertFingerprint}, password, clientOptions}`. Hide “Encryption and format”.                                                       |
| `_token`                                                                              | Validate the token, go straight to connect.                                                                                                                | Connect only, **no password field** (the token contains it). Request: `{token, clientOptions}`.                                                                                  |

## First run

When no config file exists, the window opens on the Repository screen in setup layout, with an extra line above the wizard: “Welcome to Kopia. Set up a repository to start backing up.” After the first successful create/connect, offer “Launch at login” once (a dialog with “Turn on” / “Not now”).
