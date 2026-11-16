# Design: native Kopia clients for Windows and macOS

|         |                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Status  | Draft                                                                                                                                      |
| Date    | 2026-11-16                                                                                                                                 |
| Scope   | Native desktop clients for Windows 11 and macOS that replace KopiaUI (Electron) for everyday backup use                                    |
| Related | [API client guide](api/README.md), [OpenAPI spec](api/openapi.yaml), [UI specification](ui-spec/README.md), new HTML UI on branch `new-ui` |

## 1. Summary

We build two thin native front ends, **WinUI 3 / C# on Windows** and **SwiftUI on macOS**. Each one starts a local `kopia server` process and drives it over the same REST API the HTML UI uses. All backup logic stays in the `kopia` binary. The clients own only the UI, OS integration (tray/menu bar, notifications, autostart, folder pickers) and the server lifecycle.

The two clients share no code. What they share is a **contract**: `docs/api/openapi.yaml` and the behaviour described in `docs/api/README.md`. Each client generates its API layer from the spec.

They go in a **new repository** (working name `kopia-native`), not a fork of `htmlui`. Section 10 explains why.

## 2. Goals and non-goals

**Goals**

- Feel native on each OS: Fluent/Mica on Windows 11, standard macOS controls, menu-bar extra.
- Fast startup and low idle memory. KopiaUI's Electron runtime is the main cost we want to remove.
- Cover the everyday work: see backup status, back up now, browse and restore snapshots, edit policies, watch tasks, connect or create a repository.
- Run in the background with a tray / menu-bar icon and OS notifications.
- Work with the same repository config files as KopiaUI and the CLI, so users can switch without reconfiguring.

**Non-goals (v1)**

- Reimplementing any Kopia logic (snapshotting, encryption, maintenance) natively.
- Linux. KopiaUI and the browser UI keep covering it.
- Kopia **repository server** administration (users, ACLs).
- A shared cross-platform UI layer. If we later want one codebase, Avalonia is the fallback, not a v1 goal.
- Feature parity on day one for rarely used setup paths (rclone, SFTP with external SSH). Those can open the browser UI at first (section 7.6).

## 3. Architecture

```text
┌──────────────────────────── Native app process ────────────────────────────┐
│                                                                             │
│  Views (WinUI 3 / SwiftUI)                                                  │
│     │ bind                                                                  │
│  ViewModels / Observable stores ── Polling scheduler (visibility-aware)     │
│     │ call                                                                  │
│  KopiaClient (generated from openapi.yaml + hand-written session layer)     │
│     │ HTTPS, Basic auth, CSRF header, pinned cert                           │
│  ServerHost: spawns & supervises kopia, parses stderr, owns credentials     │
│                                                                             │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │ stdin (lifetime) / stderr (params, notifications)
                ▼
        kopia server start --ui --address=127.0.0.1:0 … (one per repository config)
                │
                ▼
        repository storage (local, S3, B2, …)
```

### 3.1 Process model

- **One `kopia server` per repository config**, as in KopiaUI (`<configDir>/<repoID>.config`, first one named `repository`). Switching repositories in the UI means switching servers, not reconnecting one.
- The native app is the **parent**. It launches the server with `--shutdown-on-stdin` and keeps the stdin pipe open. If the app crashes, the pipe closes and the server exits, so no orphaned processes.
- Snapshots keep running while the window is closed, because the app stays alive in the tray / menu bar. Quitting from the tray stops all servers (`control/shutdown`, then close stdin, then kill after a timeout).
- **Not** a Windows service / launchd daemon in v1. Running as the logged-in user matches KopiaUI, avoids privilege questions and keeps VSS behaviour unchanged. A system-wide service is a possible later mode (section 12).

### 3.2 Server launch contract

The flags and stderr keys come from KopiaUI (`kopia/app/public/server.js`). The full table is in `docs/api/README.md`, "Starting a server for a desktop client".

`ServerHost` state machine:

```text
Stopped ──start──▶ Starting ──(ADDRESS + PASSWORD + CERT SHA256 seen)──▶ Running
   ▲                  │                                                    │
   └──── exited ◀─────┴───────────── exited / crash (restart w/ backoff) ◀─┘
```

- Parse stderr line by line, splitting at the first `": "`. Keep the last ~1000 lines of output for a "Server log" diagnostics view.
- `NOTIFICATION: {json}` lines go to the OS notification service (section 7.3).
- Restart with exponential backoff (1 s → 30 s) on unexpected exit, and show the state in the tray.
- Credentials live **only in memory**. They are random per launch, so there is nothing to store in Credential Manager or Keychain.

### 3.3 Session layer (hand-written, both platforms)

The generated client doesn't cover these:

1. **TLS pinning**: accept only a certificate whose SHA-256 matches `SERVER CERT SHA256`. Reject everything else, including system-trusted certificates.
2. **Basic auth** as `kopia:<SERVER PASSWORD>` on UI endpoints and `server-control:<SERVER CONTROL PASSWORD>` on `/api/v1/control/*`. Use two separate HTTP clients so the wrong user can't be sent by mistake.
3. **CSRF handshake**: `GET /` with a cookie jar, extract the `kopia-csrf-token` meta tag, then send `X-Kopia-Csrf-Token` on every UI call. On a plain-text `401 Invalid or missing CSRF token`, redo the handshake once and retry.
4. **Error mapping**: parse the `{code, error}` envelope whatever the `Content-Type`, into a typed `KopiaError(code, message, status)`. Raise a global `notConnected` event on `NOT_CONNECTED`.
5. **Cancellation**: every call takes a cancellation token or Task. Leaving a view cancels its in-flight polls.

Do **not** start the server with `--disable-csrf-token-checks` to skip step 3. The cost is one request per session, and keeping the check means any other local process that can reach the port still needs the CSRF token.

### 3.4 Data flow and polling

There is no push channel, so clients poll at the cadences in `docs/api/README.md` (sources 3 s, tasks-summary 5 s, a single task 0.5 s until finished, and so on). These rules match the HTML UI's `usePolling`:

- One scheduler per server. Views subscribe to queries, and the scheduler de-duplicates them (two views watching `sources` cause one request).
- When the window is hidden or minimized, UI polling stops. Only the **tray query** keeps running (`control/status` and `control/sources` every 5 s, server-control user), because it drives the tray icon state.
- After a mutation, refetch the affected queries right away.
- Keep the last good data on transient errors and show a stale indicator after 2 failures.

## 4. Platform stacks

### 4.1 Windows

| Concern            | Choice                                                             | Notes                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI                 | **WinUI 3** (Windows App SDK)                                      | Fluent, Mica, NavigationView left pane matches the new HTML UI sidebar.                                                                                                                                                                         |
| Language / runtime | **C# on .NET 10 (LTS)**                                            |                                                                                                                                                                                                                                                 |
| Publishing         | **Native AOT**                                                     | Fast startup, no JIT. _Open item: confirm the current Windows App SDK release supports AOT for our control set; fall back to ReadyToRun + trimming if not._                                                                                     |
| MVVM               | `CommunityToolkit.Mvvm`                                            | Source-generated, AOT-safe.                                                                                                                                                                                                                     |
| HTTP / JSON        | `HttpClient` + `System.Text.Json` **source generation**            | Reflection-based JSON breaks under AOT.                                                                                                                                                                                                         |
| API codegen        | Kiota or NSwag from `openapi.yaml`                                 | _Open item: the spec is OpenAPI 3.1 (`type: [x, "null"]`); confirm the chosen generator supports 3.1 or down-convert to 3.0 in the build. Also check that its output is AOT-clean and handles nullable arrays and sparse policies (section 6)._ |
| Tray icon          | `H.NotifyIcon.WinUI`                                               | WinUI 3 has no tray API. _Open item: verify AOT compatibility._                                                                                                                                                                                 |
| Notifications      | Windows App SDK `AppNotificationManager`                           | Toasts with "Open" / "View task" actions.                                                                                                                                                                                                       |
| Autostart          | MSIX `StartupTask` extension; `HKCU\…\Run` when unpackaged         |                                                                                                                                                                                                                                                 |
| Packaging          | **MSIX**, signed; distribute via winget (and optionally the Store) | Bundles `kopia.exe`.                                                                                                                                                                                                                            |

### 4.2 macOS

| Concern       | Choice                                                                          | Notes                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| UI            | **SwiftUI**, AppKit where needed                                                | `NavigationSplitView` sidebar.                                                                                              |
| Minimum OS    | macOS 14                                                                        | Needed for `@Observable`.                                                                                                   |
| Menu bar      | `MenuBarExtra`                                                                  | App can run with the Dock icon hidden (`LSUIElement` toggle in preferences).                                                |
| HTTP / JSON   | `URLSession` + `Codable`                                                        | Pinning via `URLSessionDelegate` (`didReceive challenge`).                                                                  |
| API codegen   | `swift-openapi-generator`                                                       | Generated `Client` plus our session middleware for auth and CSRF.                                                           |
| Notifications | `UserNotifications`                                                             |                                                                                                                             |
| Autostart     | `SMAppService.mainApp`                                                          |                                                                                                                             |
| Packaging     | Developer-ID signed, **notarized**, universal binary; DMG + Sparkle for updates | Bundles a universal `kopia` binary in `Contents/Resources`; it must be signed with the app's identity and hardened runtime. |

### 4.3 Why not one cross-platform toolkit

Avalonia, Flutter or Tauri would give one codebase, but each compromises the "feels native" goal. Tauri would also mostly re-wrap the HTML UI, which KopiaUI already does. The UI layer is moderate in size (about 7 screens), and the hard parts (API contract, server lifecycle) are specified once in this repository. Two native UIs are an acceptable cost. Revisit this if one platform falls far behind the other.

## 5. Feature scope (v1)

The screens mirror the new HTML UI (branch `new-ui`), so behaviour and wording stay aligned. The endpoints for each screen are in the spec. Every screen, field, rule and string is specified in the [UI specification](ui-spec/README.md); native-only behaviour (tray, server states, repository model, other storage types, throttling) is in [ui-spec/native-only.md](ui-spec/native-only.md).

| Screen                    | Contents                                                                                                                                                    | Key endpoints                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Snapshots (dashboard)** | Sources with status, last/next snapshot, size, live progress; "Back up now", "Cancel"                                                                       | `sources`, `sources/upload`, `sources/cancel`                                                                    |
| **Source detail**         | Snapshot history (unique / all), pins, description, delete; browse a snapshot's folder tree; download file; restore; mount + "Open in Explorer/Finder"      | `snapshots`, `snapshots/edit`, `snapshots/delete`, `objects/{id}`, `restore`, `mounts`                           |
| **New snapshot**          | Pick folder, resolve path, optional estimate, policy overrides, start                                                                                       | `paths/resolve`, `estimate`, `policy/resolve`, `sources` (POST)                                                  |
| **Policies**              | List by target kind; editor with inherited values and "defined at" hints; upcoming snapshot times                                                           | `policies`, `policy`, `policy/resolve`                                                                           |
| **Tasks**                 | Running/finished list, detail with counters and live log, cancel                                                                                            | `tasks`, `tasks/{id}`, `tasks/{id}/logs`, `tasks/{id}/cancel`                                                    |
| **Repository**            | Status; connect/create (filesystem, S3, B2, Azure, GCS, WebDAV, SFTP, repository server, token); disconnect; description; switch between known repositories | `repo/*`, `current-user`                                                                                         |
| **Preferences**           | Theme, byte units, page size; notification profiles (email, Pushover, webhook) with test; launch at login; throttling (new vs HTML UI)                      | `ui-preferences`, `notificationProfiles`, `testNotificationProfile`, `repo/throttle`                             |
| **Tray / menu bar**       | Overall state icon (idle / running / error / disconnected), per-source "Back up now", open window, pause all, quit                                          | `control/status`, `control/sources`, `control/trigger-snapshot`, `control/pause-source`, `control/resume-source` |

## 6. Modelling the API in typed languages

The API was written for JavaScript. These spots need deliberate handling in C# and Swift:

- **Sparse policies.** Every leaf of `Policy` is optional, and "absent" means "inherit". Model each one as nullable and serialize with "omit when null" (`JsonIgnoreCondition.WhenWritingNull` / `encodeIfPresent`). Never round-trip a fully defaulted policy, because that would pin every inherited value. Port `cleanPolicy` from `src/app/pages/policies/policyModel.ts` (trim lists, drop actions without a script, default action timeout 300 s).
- **Policy definition** (`ResolvePolicyResponse.definition`) has the same shape as `Policy`, but its leaves are `SourceInfo`. Generate it as a separate type, or walk it as a JSON tree.
- **Provider `config` objects** (storage, notification method). Their shape depends on a sibling `type` field, which OpenAPI can't express as a discriminator, so generated code gets a loose `anyOf`. Hand-write one config struct per provider and pick it by `type`.
- **`null` vs `[]`.** Go sends `null` for empty slices. Decoders must accept both.
- **Timestamps** have nanosecond precision. Use a lenient ISO 8601 parser; `DateTimeOffset` and `Date` truncate, which is fine for display.
- **Task log lines** carry arbitrary extra keys. Decode `ts`, `level`, `mod`, `msg` and keep the rest as a raw dictionary.

## 7. OS integration

### 7.1 Replacing the `window.kopiaUI` bridge

The HTML UI calls two functions that KopiaUI injects. Native clients replace them directly:

| Bridge call                                                                   | Windows                                                  | macOS                                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| `selectDirectory(cb)`: folder picker for snapshot sources and restore targets | `FolderPicker` (Windows App SDK)                         | `NSOpenPanel` (`canChooseDirectories`)           |
| `browseDirectory(path)`: open a mounted snapshot                              | `Launcher.LaunchFolderPathAsync` / `explorer.exe <path>` | `NSWorkspace.shared.open(URL(fileURLWithPath:))` |

The server runs on the same machine as the client, so local paths picked in the UI are valid for the server.

### 7.2 Mounting

`POST mounts` returns a path. On Windows the server maps a WebDAV share to a drive letter with `net use`; on macOS it is a WebDAV mount. Show "Open" (above) and "Unmount". Unmount everything the app mounted on quit.

### 7.3 Notifications

Two sources:

1. `NOTIFICATION:` lines on server stderr (snapshot failures, and successes if the user's profiles want them). Map severity: ≥ 20 error, ≥ 10 warning, otherwise info. Respect a per-app "notify on success" toggle.
2. Client-side state changes detected while polling the tray query (server crashed, repository disconnected).

The server-side notification profiles (email, webhook, Pushover) are managed in Preferences and are independent of OS notifications.

### 7.4 Autostart and background

"Launch at login" is off by default and offered during first-run setup. When started at login, the app opens to the tray only.

### 7.5 Coexistence with KopiaUI and the CLI

- Use the **same config directory** as KopiaUI: `%APPDATA%\kopia` on Windows, `~/Library/Application Support/kopia` on macOS, with the same `<repoID>.config` naming (KopiaUI uses Electron's `appData` + `kopia`, see `kopia/app/public/config.js`). Users can then switch apps without reconnecting. KopiaUI's portable mode (config next to the executable) is out of scope for v1.
- Detect a running KopiaUI (or another server holding the same config) and refuse to start a second server for that config. Two schedulers on one source would snapshot twice.
- Repository passwords stay where Kopia keeps them (OS keyring / config). The native app never stores them.

### 7.6 Fallback to the HTML UI

While a setup form isn't implemented natively yet, "Open in browser" launches `https://127.0.0.1:<port>/` in the default browser. The user signs in with basic auth (`kopia` / session password, which can be copied from the app). The browser will warn about the self-signed certificate; the app shows the expected SHA-256 fingerprint so the user can check it. This also serves as a support and debug path.

## 8. Security

- The server listens on **127.0.0.1 only**, on a random port, over TLS with a per-launch self-signed certificate, and the client pins its fingerprint.
- Random UI and control passwords per launch, kept in memory only and never logged. Scrub them from the diagnostics log view.
- The CSRF check stays enabled (section 3.3).
- The bundled `kopia` binary is signed with the app's identity (MSIX / notarized bundle), and the app launches it by absolute path inside its own package, never from `PATH`.
- Before/after snapshot actions run only when the repository connection has `enableActions` set (off unless the user turns it on, like `kopia repository connect --enable-actions`). The connect form shows it as an explicit, warned option.

## 9. Packaging, versioning and updates

- Each client release **pins one `kopia` version**. CI downloads that release, checks its signature/checksum and bundles it.
- Because the API is unversioned, CI runs the contract tests (section 11) against the pinned binary on every bump. A bump that changes `serverapi` or the route table also needs an `openapi.yaml` update in this repository.
- Update channels: winget/MSIX auto-update on Windows, Sparkle on macOS.

## 10. Repository layout and why not a fork

```text
kopia-native/
  spec/             # git submodule or pinned copy of htmlui/docs/api (single source of truth)
  windows/          # WinUI 3 solution (Kopia.App, Kopia.Client, Kopia.ServerHost, tests)
  macos/            # Xcode project / SwiftPM packages (KopiaClient, ServerHost, App, tests)
  contract-tests/   # language-neutral API tests run against a real kopia server
  scripts/          # fetch-kopia, codegen, signing
```

A fork of `htmlui` would carry the React code, its history and upstream merges, and none of that is used here. The only shared artifact is the API spec. Keeping it in `htmlui/docs/api` puts it next to the TypeScript client (`src/api`) it describes, so spec changes are reviewed with the code that relies on them. The native repo consumes it as a pinned dependency.

_Alternative:_ move the spec into its own small repository once a third consumer appears.

## 11. Testing

- **Contract tests**: start a real `kopia server` against a temporary filesystem repository and exercise every endpoint in the spec, validating responses against `openapi.yaml`. Run on Windows and macOS CI. This is the main defence against unannounced server API changes.
- **Session-layer tests**: pinning rejects a wrong certificate; CSRF re-handshake after `401`; `NOT_CONNECTED` routing; stderr parsing with lines split across reads.
- **ViewModel / store tests** with a fake client (port the scenarios from `tests/app/*.test.tsx` where they apply).
- **UI smoke tests**: WinAppDriver / Appium on Windows, XCUITest on macOS. Cover connect repository → back up now → browse → restore.
- **Soak test**: 24 h idle with the tray only. Check that memory stays flat and polling pauses while the window is hidden.

## 12. Open questions and risks

| #   | Item                                                           | Risk              | Plan                                                                                                      |
| --- | -------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Native AOT for WinUI 3 with our control set and `H.NotifyIcon` | Medium            | Spike in milestone 1; fall back to ReadyToRun + trimming.                                                 |
| 2   | Unversioned server API changes                                 | Medium            | Pin the kopia version and run contract tests on bump (section 9). Propose an API version header upstream. |
| 3   | Same-config conflict with a running KopiaUI                    | Medium            | Detect and refuse (section 7.5); add a lock-file check if detection proves unreliable.                    |
| 4   | macOS sandboxing                                               | High if App Store | v1 ships outside the Mac App Store (no sandbox). The bundled server needs broad file access for backups.  |
| 5   | VSS (shadow copies) needs elevation on Windows                 | Known             | Same as KopiaUI today. Document it; a later "service mode" could run elevated.                            |
| 6   | Polling cost with many sources                                 | Low               | Visibility-aware scheduler; tray uses one lightweight query.                                              |
| 7   | Upstream interest                                              | —                 | Share this design with kopia maintainers before milestone 3 in case they want the clients upstream.       |

## 13. Milestones

1. **Foundations**: `ServerHost` and session layer on both platforms; generated clients; contract test harness in CI. Exit: the app starts a server, completes the handshake and shows `repo/status`.
2. **Read-only MVP**: tray / menu bar, Snapshots dashboard, source detail with browse and download, Tasks. Exit: daily status checking works without KopiaUI.
3. **Actions**: back up now / cancel, restore, mount, new snapshot with estimate, notifications, autostart.
4. **Configuration**: policy editor, repository connect/create for filesystem, S3, B2, Azure, GCS, WebDAV, repository server and token; preferences; browser fallback for the rest.
5. **Release**: signing, MSIX/winget, notarized DMG + Sparkle, docs, beta.
