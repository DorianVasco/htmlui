# Kopia Server API: client guide

[`openapi.yaml`](openapi.yaml) lists every endpoint and schema. This file covers what OpenAPI expresses poorly: how a client authenticates, how errors look, how long-running work is tracked, and the encoding quirks a typed client must handle.

It applies to every UI client of `kopia server`: the HTML UI in this repository, KopiaUI (Electron), and the planned native clients ([design doc](../native-clients-design.md)).

## Provenance

Every schema is marked `x-source: server`: it was taken from the Go source of `kopia/kopia` at commit `b6272a4e` (2026-11-14), not inferred from what this UI sends. The route list matches the server's route table exactly (56 operations).

Key server files: `internal/server/server.go` (routes, auth), `internal/server/server_authz_checks.go` (CSRF), `internal/serverapi/serverapi.go` (DTOs), `repo/blob/<provider>/*_options.go` (storage configs), `app/public/server.js` (how KopiaUI launches the server).

## Starting a server for a desktop client

KopiaUI starts one server per repository config like this. A native client should use the same flags:

```text
kopia server start --ui \
  --address=127.0.0.1:0 \
  --tls-generate-cert --tls-generate-cert-name=127.0.0.1 --tls-print-server-cert \
  --random-password --random-server-control-password \
  --async-repo-connect \
  --error-notifications=always --kopiaui-notifications \
  --shutdown-on-stdin \
  --config-file=<configDir>/<repoID>.config
  [--cache-directory=… --log-dir=…]   # portable mode only
```

The server prints its parameters on **stderr**, one `KEY: value` per line:

| Line                                       | Use                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `SERVER ADDRESS: https://127.0.0.1:<port>` | Base URL. The port is random.                                                         |
| `SERVER PASSWORD: <pw>`                    | Password of the UI user (`kopia` unless `--server-username` is set).                  |
| `SERVER CONTROL PASSWORD: <pw>`            | Password of the `server-control` user (control API).                                  |
| `SERVER CERT SHA256: <hex>`                | Pin this fingerprint and reject any other certificate.                                |
| `SERVER CERTIFICATE: <base64 PEM>`         | Alternative to pinning: trust this exact certificate.                                 |
| `NOTIFICATION: <json>`                     | A notification (because of `--kopiaui-notifications`). Show it as an OS notification. |

The server counts as running once address, password and fingerprint have all arrived. `--shutdown-on-stdin` makes the server exit when its stdin closes, so it never outlives the host. Keep the pipe open and close it to stop the server.

For development, `dev-start-server.sh` uses `--insecure --without-password --disable-csrf-token-checks` on plain HTTP. Never ship those flags.

## Authentication

Two users exist. Each request must use the right one:

| User                | Default name     | Endpoints                             | CSRF token                           |
| ------------------- | ---------------- | ------------------------------------- | ------------------------------------ |
| UI user             | `kopia`          | everything except `/api/v1/control/*` | required (except `GET objects/{id}`) |
| Server-control user | `server-control` | `/api/v1/control/*` only              | not checked                          |

- Send HTTP Basic auth on **every** request. After a successful login the server also sets a `Kopia-Auth` cookie (a short-lived JWT, `HttpOnly`, `SameSite=Strict`). It only saves the server from re-hashing the password; basic auth is still required.
- A request with the wrong user gets `403 ACCESS_DENIED`. Missing or invalid credentials get `401` with a **plain-text** body and `WWW-Authenticate: Basic realm="Kopia"`.

### CSRF handshake

Every UI endpoint checks `X-Kopia-Csrf-Token` unless the server runs with `--disable-csrf-token-checks`. The token is `hex(HMAC-SHA256(serverKey, sessionCookie))`, so a client cannot compute it. It has to fetch it:

1. `GET /` with basic auth and a cookie jar.
2. The response sets `Kopia-Session-Cookie` (session cookie, no expiry) and contains `<meta name="kopia-csrf-token" content="<token>" />` just before `</head>`.
3. Send `Cookie: Kopia-Session-Cookie=…` and `X-Kopia-Csrf-Token: <token>` on every later request.

The same cookie always produces the same token, so the token stays valid as long as the cookie is kept. Kopia's own Go client does exactly this (`apiclient.FetchCSRFTokenForTesting`). A missing or wrong token returns `401 "Invalid or missing CSRF token."` as plain text. Treat that as "redo the handshake once, then fail".

`GET /` only works if the server was started with `--ui` (it serves `index.html`). Native clients must therefore keep `--ui`, even though they don't show the HTML UI.

## Errors

Errors from API handlers use one envelope:

```json
{ "code": "NOT_CONNECTED", "error": "not connected" }
```

The response is sent with `Content-Type: text/plain; charset=utf-8`, but the body is JSON. Parse by status code, not content type.

| Status   | Typical `code`                                                                                                                                                                   | Notes                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 400      | `MALFORMED_REQUEST`, `NOT_CONNECTED`, `NOT_INITIALIZED`, `INVALID_PASSWORD`, `INVALID_TOKEN`, `ALREADY_CONNECTED`, `ALREADY_INITIALIZED`, `STORAGE_CONNECTION`, `PATH_NOT_FOUND` | Also `NOT_FOUND` for `GET policy` (no policy at that target) and `snapshots/delete` (unknown source). |
| 403      | `ACCESS_DENIED`                                                                                                                                                                  | Wrong user for this endpoint.                                                                         |
| 404      | `NOT_FOUND`                                                                                                                                                                      | Unknown task, mount not found, no source matched a filter.                                            |
| 500      | `INTERNAL`                                                                                                                                                                       | Message starts with `internal server error: `.                                                        |
| 401, 413 | —                                                                                                                                                                                | Plain text from the auth / body-size layer. Request bodies are capped at 100 kB.                      |

`GET objects/{id}` returns plain-text errors (400/404) because it serves raw content.

**`NOT_CONNECTED`** is the important one. Every endpoint that needs an open repository returns it when none is open. The HTML UI sends the user to the repository page whenever it sees this code (`onNotConnected` in `src/api/client.ts`). Native clients should switch to their "connect repository" view the same way.

These endpoints work while disconnected: `repo/status`, `repo/connect`, `repo/create`, `repo/exists`, `repo/algorithms`, `current-user`, `ui-preferences`, `tasks`, `tasks-summary`, `tasks/{id}`, `tasks/{id}/logs`, `tasks/{id}/cancel`, `control/status`, `control/shutdown`.

## Long-running work: tasks

Snapshots, restores, estimates, maintenance and repository open/connect all run as **tasks**.

- `POST restore` and `POST estimate` return the started `Task` right away.
- Snapshots started with `sources/upload` don't return a task. Their task ID shows up in `SourceStatus.currentTask`, and live counters are in `SourceStatus.upload`.
- `repo/connect` waits up to `syncWaitTime` seconds. If the connect is still running, the response has `connected: false` plus `initTaskID`. The server also reports `initTaskID` from `repo/status` while it opens the repository at startup (`--async-repo-connect`).

Lifecycle: `RUNNING → SUCCESS | FAILED`, or `RUNNING → CANCELING → CANCELED` after `tasks/{id}/cancel`. A task is finished once `endTime` is set. Finished tasks stay in `tasks` for a while, and `tasks-summary` counts them.

Task logs are a bounded ring buffer. Old lines drop off, and logging stops when the task finishes. Each line is a zap JSON object: `ts` (Unix seconds, fractional), `level` (0 debug, 1 info, 2 warning, 3 error), `mod`, `msg`, plus arbitrary extra fields.

## Polling

The server has no push channel (no WebSocket or SSE). The HTML UI polls at these rates (`src/api/hooks.ts`). Native clients should match them:

| Data                        | Interval                                 | Stop condition       |
| --------------------------- | ---------------------------------------- | -------------------- |
| `tasks-summary` (nav badge) | 5 s                                      | —                    |
| `sources`                   | 3 s                                      | —                    |
| `tasks`                     | 3 s                                      | —                    |
| `tasks/{id}/logs`           | 3 s                                      | task has `endTime`   |
| `tasks/{id}`                | 0.5 s                                    | task has `endTime`   |
| `repo/status`               | on demand; 1 s while `initTaskID` is set | `initTaskID` cleared |

Pause polling while the window is hidden or minimized. A tray or menu-bar icon needs only `control/status` and `control/sources` (KopiaUI polls `control/status` with the server-control user). After a mutation, refetch the affected list right away instead of waiting for the next tick.

## Encoding rules

- **Timestamps** are RFC 3339 strings in UTC with up to nanosecond precision. Parsers must accept 9 fractional digits; .NET `DateTimeOffset` keeps only 7, which is fine for display.
- **Task log `ts`** is a number (Unix seconds), not a string.
- **64-bit integers.** Sizes and counts can exceed 2^53. Use `long`/`Int64`.
- **Permissions** (`DirEntry.mode`) are octal strings like `"0755"`.
- **Entry type** (`DirEntry.type`): `f` file, `d` directory, `s` symlink.
- **`osSnapshots.volumeShadowCopy.enable`** is a number: 0 never, 1 always, 2 when-available.
- **Log detail** values are 0–10 (0 none, 5 normal, 10 max).
- **Nullable arrays.** Go encodes empty slices as `null` in several places (`retention`, `pins`, `counters`, `upcomingSnapshotTimes`, task `logs`, and the whole `GET notificationProfiles` body when there are no profiles). Some nested objects can be `null` too (`Snapshot.summary`, policy `effective`/`definition`/`defined`). The spec marks all of these nullable. Treat `null` as empty.
- **Sparse policies.** A `Policy` contains only the fields set at that level. Missing means "inherit", which is different from `false` or `0`. Typed clients must model every policy leaf as optional and must not send defaults back. When saving, drop blank list entries and actions without a script, and default action `timeout` to 300 (see `cleanPolicy` in `src/app/pages/policies/policyModel.ts`).
- **Policy targets** go in the query string (`userName`, `host`, `path`), always all three, empty for unused parts:

  | Target | userName | host | path      |
  | ------ | -------- | ---- | --------- |
  | Global | ""       | ""   | ""        |
  | Host   | ""       | host | ""        |
  | User   | user     | host | ""        |
  | Folder | user     | host | /abs/path |

- **Source filters** on `sources`, `sources/upload`, `sources/cancel` and `policies` use the same three parameters, but an empty value means "match any". `sources/upload` with no parameters starts **all** local sources.
- **UI preferences** are a fixed set of fields. Anything else is dropped on save (including `preferWebDav`, which this UI's TypeScript type includes). Keep client-only settings locally.

## Endpoints the HTML UI does not use

- `GET/PUT repo/throttle`: storage throttling. A native client could add it to its settings.
- `POST refresh`: alias of `repo/sync`.
- `GET mounts` and `GET notificationProfiles/{name}`.
- All `/api/v1/control/*` endpoints: for the process that launched the server (tray status, pause/resume, shutdown).

## Not part of this API

- The gRPC repository service, which other Kopia clients use when this server acts as a **repository server**. It uses per-user repository ACLs and is out of scope.
- `/metrics` (Prometheus), when metrics are enabled.

## Keeping this spec current

The API is not versioned. When the bundled `kopia` binary changes:

1. Diff `internal/server/server.go` route registrations (`SetupHTMLUIAPIHandlers`, `SetupControlAPIHandlers`) against `paths` here.
2. Diff `internal/serverapi/serverapi.go` and the structs it embeds against `components/schemas`.
3. Re-check the stderr keys in `app/public/server.js`.
4. Bump `info.version` and record the kopia commit in `info.description`.

Validate after editing:

```bash
npx @redocly/cli lint docs/api/openapi.yaml
```
