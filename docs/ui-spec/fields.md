# Field catalog

Every input in the UI: label, help text, control, default, validation and the API field it maps to. Screen specs reference this file for details.

Columns: **Label** and **Help** are exact UI text. **Path** is the JSON path in the request or policy definition. **Control** names the control type (native equivalents in [design-tokens.md](design-tokens.md#controls)).

## Path field

Source: `src/app/PathField.tsx`. Used by New snapshot (“Folder to back up”) and the setup wizard (“Directory”).

- Text input with a folder icon and a dropdown of suggestions. The dropdown opens on focus showing all suggestions. Typing filters them by case-insensitive substring (an option exactly equal to the input is hidden). Max 20 shown.
- Groups: “Recently used” (caller-provided, with an optional dimmed caption), then “Common locations” (home-relative paths like `~/Documents` resolved by `POST paths/resolve`; locations that fail to resolve and duplicates of recent paths are left out). The first resolved location gets a home icon, the rest folder icons.
- The help line ends with “Use Browse to pick a folder.” when a native folder picker exists, otherwise “Pick a suggestion, type a path on the server's computer (“~” is your home folder).”
- **Native**: always show the “Browse…” button (`IconFolderOpen`, accessible name “Browse for folder”) on the right, opening the OS folder picker. Keep the suggestions. Use the first help-line variant.

## Policy editor

Source: `src/app/pages/policies/PolicyEditor.tsx`, `PolicyFields.tsx`. Control types are explained in [screens/policies.md](screens/policies.md#tabs). Every field also shows the “Effective: …” line. All paths are checked against `Policy` in [openapi.yaml](../api/openapi.yaml).

### Schedule

| Label                           | Help                                                 | Control                                               | Path                         | Values / format                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot every                  | Only applies while KopiaUI or the Kopia server runs. | Select                                                | `scheduling.intervalSeconds` | 600 “every 10 minutes”, 900 “every 15 minutes”, 1200 “every 20 minutes”, 1800 “every 30 minutes”, 3600 “every hour”, 10800 “every 3 hours”, 21600 “every 6 hours”, 43200 “every 12 hours”, 86400 “every 24 hours”. Effective value formatted by `formatInterval` (other values: “every {n} minutes”). |
| At times of day                 | 24-hour format. Press Enter after each time.         | Times of day, placeholder “e.g. 02:00”                | `scheduling.timeOfDay`       | `[{hour, min}]`, sorted. Invalid entries are dropped with the error “Not a time of day: {entries} (use 24-hour HH:MM)” (`parseTimeOfDay`).                                                                                                                                                            |
| Cron expressions                | One per line: minute hour day month weekday.         | Lines, placeholder “0 2 \* \* 1-5 # weekdays at 2:00” | `scheduling.cron`            | string list                                                                                                                                                                                                                                                                                           |
| Run missed snapshots on startup | For time-of-day schedules.                           | Boolean                                               | `scheduling.runMissed`       |                                                                                                                                                                                                                                                                                                       |
| Manual snapshots only           | Turns off all scheduled snapshots.                   | Boolean                                               | `scheduling.manual`          |                                                                                                                                                                                                                                                                                                       |

Then the “Upcoming snapshots” box.

### Retention

Intro: “How many snapshots to keep per folder. For each period, the latest snapshot in it is kept.” Numbers in a two-column grid, no help text:

| Label   | Path                    |
| ------- | ----------------------- |
| Latest  | `retention.keepLatest`  |
| Hourly  | `retention.keepHourly`  |
| Daily   | `retention.keepDaily`   |
| Weekly  | `retention.keepWeekly`  |
| Monthly | `retention.keepMonthly` |
| Annual  | `retention.keepAnnual`  |

| Label                    | Help                                             | Control | Path                                 |
| ------------------------ | ------------------------------------------------ | ------- | ------------------------------------ |
| Skip identical snapshots | Don't keep a new snapshot when no files changed. | Boolean | `retention.ignoreIdenticalSnapshots` |

### Files

| Label                                          | Help                                                                                                       | Control                                                                                  | Path                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------ |
| Ignore                                         | One rule per line, like .gitignore (syntax). “syntax” links to https://kopia.io/docs/advanced/kopiaignore/ | Lines, placeholder “node_modules/” and “\*.tmp” on two lines                             | `files.ignore`           |
| Don't use ignore rules of parent policies      | —                                                                                                          | Flag                                                                                     | `files.noParentIgnore`   |
| Ignore rule files                              | Files in a folder that add ignore rules for it.                                                            | Tags, placeholder “e.g. .kopiaignore”                                                    | `files.ignoreDotFiles`   |
| Don't use ignore rule files of parent policies | —                                                                                                          | Flag                                                                                     | `files.noParentDotFiles` |
| Ignore cache folders                           | Folders marked with CACHEDIR.TAG and similar.                                                              | Boolean                                                                                  | `files.ignoreCacheDirs`  |
| Ignore files larger than                       | —                                                                                                          | Number in bytes (thousands separators, suffix “ bytes”). Effective: “{size} ({n} bytes)” | `files.maxFileSize`      |
| Stay on one file system                        | Don't follow into other drives or mounts.                                                                  | Boolean                                                                                  | `files.oneFileSystem`    |

### Errors

| Label                      | Help                                       | Control | Path                                  |
| -------------------------- | ------------------------------------------ | ------- | ------------------------------------- |
| Ignore folder read errors  | Treat them as warnings instead of failing. | Boolean | `errorHandling.ignoreDirectoryErrors` |
| Ignore file read errors    | Treat them as warnings instead of failing. | Boolean | `errorHandling.ignoreFileErrors`      |
| Ignore unknown entry types | E.g. sockets or devices.                   | Boolean | `errorHandling.ignoreUnknownTypes`    |

### Compression

| Label                     | Help | Control                       | Path                         | Values                                                                                                                                 |
| ------------------------- | ---- | ----------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Algorithm                 | —    | Select                        | `compression.compressorName` | “none”, then every `compression` entry of `GET repo/algorithms` except “none”, labelled with its ID plus “ (deprecated)” if deprecated |
| Only files larger than    | —    | Number in bytes               | `compression.minSize`        |                                                                                                                                        |
| Only files smaller than   | —    | Number in bytes               | `compression.maxSize`        |                                                                                                                                        |
| Only compress extensions  | —    | Tags, placeholder “e.g. .txt” | `compression.onlyCompress`   |                                                                                                                                        |
| Never compress extensions | —    | Tags, placeholder “e.g. .mp4” | `compression.neverCompress`  |                                                                                                                                        |

### Upload

| Label               | Help                                                                                                                                                                   | Control | Path                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------- |
| Parallel snapshots  | “How many snapshots may upload at the same time.” For folder policies the field is disabled and the help reads “Can only be set in global, computer or user policies.” | Number  | `upload.maxParallelSnapshots` |
| Parallel file reads | Defaults to the number of processor cores.                                                                                                                             | Number  | `upload.maxParallelFileReads` |

### Actions

Intro: “Commands to run around snapshots, e.g. to stop a database or create a file system snapshot.” Four groups, a divider between the second and third:

| Group title        | Path prefix                  |
| ------------------ | ---------------------------- |
| Before snapshot    | `actions.beforeSnapshotRoot` |
| After snapshot     | `actions.afterSnapshotRoot`  |
| Before each folder | `actions.beforeFolder`       |
| After each folder  | `actions.afterFolder`        |

Each group has:

| Label             | Control                                         | Path suffix | Notes                                                                                                  |
| ----------------- | ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| Script            | Text, placeholder “command or path to a script” | `.script`   | A group without a script is removed on save (`cleanPolicy`).                                           |
| Timeout (seconds) | Number, placeholder “300”                       | `.timeout`  | Saved as 300 if empty and a script is set.                                                             |
| Mode              | Select                                          | `.mode`     | `essential` “Must succeed”, `optional` “Ignore failures”, `async` “Run in background, ignore failures” |

Actions only run if the repository connection has `enableActions` ([design doc §8](../native-clients-design.md#8-security)). Native: show an info line on this tab when it doesn't: “Actions are turned off for this repository. Turn them on when connecting.”

### Logging

Intro: “How much detail snapshot logs contain.” Selects in a two-column grid, values 0–10 with labels “0 – no output”, “1 – minimal”, “2”, “3”, “4”, “5 – normal”, “6”, “7”, “8”, “9”, “10 – maximum”:

| Label                      | Path                              |
| -------------------------- | --------------------------------- |
| Folder backed up           | `logging.directories.snapshotted` |
| Folder ignored             | `logging.directories.ignored`     |
| File backed up             | `logging.entries.snapshotted`     |
| File ignored               | `logging.entries.ignored`         |
| Unchanged file (cache hit) | `logging.entries.cacheHit`        |
| Changed file (cache miss)  | `logging.entries.cacheMiss`       |

### Other

| Label                               | Help                                                                      | Control                                           | Path       |
| ----------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- | ---------- |
| Don't inherit from broader policies | This folder and its subfolders ignore global, computer and user policies. | Flag                                              | `noParent` |
| JSON                                | —                                                                         | Read-only code block of `cleanPolicy(definition)` | —          |

### Native addition (Windows only)

Add to the Files tab (divergence D6):

| Label                  | Help                                                                       | Control | Path                                  | Values                                                          |
| ---------------------- | -------------------------------------------------------------------------- | ------- | ------------------------------------- | --------------------------------------------------------------- |
| Use volume shadow copy | Back up files that are open in other programs. Needs administrator rights. | Select  | `osSnapshots.volumeShadowCopy.enable` | 0 “Never”, 1 “Always (fail if unavailable)”, 2 “When available” |

## Setup wizard

Source: `src/app/pages/repository/SetupWizard.tsx`.

### Step 3

| Label               | Help                                            | Control                                                                                          | Default                       | Validation                            | Request path                |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------- | --------------------------- |
| Repository password | —                                               | Password, required, focused; autocomplete “new-password” (create) / “current-password” (connect) | empty                         | “Enter a password” if empty on submit | `password`                  |
| Confirm password    | —                                               | Password, create only                                                                            | empty                         | “Passwords don't match”               | —                           |
| Description         | Shown in the header to tell repositories apart. | Text                                                                                             | “My Repository”               | —                                     | `clientOptions.description` |
| Username            | —                                               | Text, in “Identity of this computer”                                                             | `GET current-user` `username` | —                                     | `clientOptions.username`    |
| Hostname            | —                                               | Text, same section                                                                               | `GET current-user` `hostname` | —                                     | `clientOptions.hostname`    |
| Connect read-only   | —                                               | Switch, connect only                                                                             | off                           | —                                     | `clientOptions.readonly`    |

“Encryption and format” section (create only). Option labels: the algorithm ID, plus “ (recommended)” for the server's default, or “ (not recommended)” for deprecated ones. Options and defaults come from `GET repo/algorithms`.

| Label                                | Help                                         | Control                                         | Default             | Request path                                                                                                    |
| ------------------------------------ | -------------------------------------------- | ----------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Encryption                           | —                                            | Select                                          | `defaultEncryption` | `options.blockFormat.encryption`                                                                                |
| Hash algorithm                       | —                                            | Select                                          | `defaultHash`       | `options.blockFormat.hash`                                                                                      |
| Splitter                             | —                                            | Select                                          | `defaultSplitter`   | `options.objectFormat.splitter`                                                                                 |
| Error correction overhead            | Protects against bit rot, costs extra space. | Select: “Disabled” (0), “1%”, “2%”, “5%”, “10%” | Disabled            | `options.blockFormat.eccOverheadPercent` (integer)                                                              |
| Error correction algorithm           | —                                            | Select, disabled while overhead is Disabled     | `defaultEcc`        | `options.blockFormat.ecc`                                                                                       |
| Legacy format (Kopia 0.8 compatible) | Only needed for very old clients.            | Switch                                          | off                 | when on, `options.blockFormat.version: 1`; when off, `version` is omitted so the server uses its current format |

## Storage forms

> Native forms for the storage types the new web UI hands to the classic setup. Labels below are rewritten in sentence case. The original classic-setup label is given for reference. Field names and required fields come from the classic setup (`src/components/SetupRepository*.jsx`) and the server's option structs (`repo/blob/<provider>/*_options.go`). Secret fields use password inputs.

### Amazon S3 or compatible (`s3`)

| Label                        | Classic label                  | Path (`storage.config.`) | Control  | Required | Placeholder                                            |
| ---------------------------- | ------------------------------ | ------------------------ | -------- | -------- | ------------------------------------------------------ |
| Bucket                       | Bucket                         | `bucket`                 | text     | yes      | enter bucket name                                      |
| Server endpoint              | Server Endpoint                | `endpoint`               | text     | yes      | enter server address (e.g., s3.amazonaws.com)          |
| Region                       | Override Region                | `region`                 | text     |          | enter specific region (e.g., us-west-1) or leave empty |
| Use HTTP (insecure)          | Use HTTP connection (insecure) | `doNotUseTLS`            | switch   |          |                                                        |
| Don't verify TLS certificate | Do not verify TLS certificate  | `doNotVerifyTLS`         | switch   |          |                                                        |
| Access key ID                | Access Key ID                  | `accessKeyID`            | text     | yes      | enter access key ID                                    |
| Secret access key            | Secret Access Key              | `secretAccessKey`        | password | yes      | enter secret access key                                |
| Session token                | Session Token                  | `sessionToken`           | password |          | enter session token or leave empty                     |
| Object name prefix           | Object Name Prefix             | `prefix`                 | text     |          | enter object name prefix or leave empty                |

### Backblaze B2 (`b2`)

| Label              | Classic label      | Path                                                     | Control  | Required | Placeholder                             |
| ------------------ | ------------------ | -------------------------------------------------------- | -------- | -------- | --------------------------------------- |
| Bucket             | B2 Bucket          | `bucket`                                                 | text     | yes      | enter bucket name                       |
| Key ID             | Key ID             | `keyID` (classic sends `keyId`; the server accepts both) | text     | yes      | enter application or account key ID     |
| Key                | Key                | `key`                                                    | password | yes      | enter secret application or account key |
| Object name prefix | Object Name Prefix | `prefix`                                                 | text     |          | enter object name prefix or leave empty |

### Google Cloud Storage (`gcs`)

| Label              | Classic label      | Path              | Control                                      | Required | Placeholder                             |
| ------------------ | ------------------ | ----------------- | -------------------------------------------- | -------- | --------------------------------------- |
| Bucket             | GCS Bucket         | `bucket`          | text                                         | yes      | enter bucket name                       |
| Object name prefix | Object Name Prefix | `prefix`          | text (classic wrongly uses a password input) |          | enter object name prefix or leave empty |
| Credentials file   | Credentials File   | `credentialsFile` | file path + Browse                           |          | enter name of credentials JSON file     |
| Credentials JSON   | Credentials JSON   | `credentials`     | multi-line, sent as a JSON object            |          | paste JSON credentials here             |

### Azure Blob Storage (`azureBlob`)

| Label              | Classic label        | Path             | Control  | Required | Placeholder                                                             |
| ------------------ | -------------------- | ---------------- | -------- | -------- | ----------------------------------------------------------------------- |
| Container          | Container            | `container`      | text     | yes      | enter container name                                                    |
| Object name prefix | Object Name Prefix   | `prefix`         | text     |          | enter object name prefix or leave empty                                 |
| Storage account    | Storage Account      | `storageAccount` | text     | yes      | enter storage account name                                              |
| Access key         | Access Key           | `storageKey`     | password |          | enter secret access key                                                 |
| Storage domain     | Azure Storage Domain | `storageDomain`  | text     |          | enter storage domain or leave empty for default 'blob.core.windows.net' |
| SAS token          | SAS Token            | `sasToken`       | password |          | enter secret SAS Token                                                  |

### SFTP server (`sftp`)

| Label                                     | Classic label | Path          | Control | Required                               | Placeholder                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------- | ------------- | ------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host                                      | Host          | `host`        | text    | yes                                    | ssh host name (e.g., example.com)                                                                                                                                                                                                                                      |
| User                                      | User          | `username`    | text    | yes                                    | user name                                                                                                                                                                                                                                                              |
| Port                                      | Port          | `port`        | number  | yes (classic validates it as required) | port number (e.g., 22)                                                                                                                                                                                                                                                 |
| Path                                      | Path          | `path`        | text    | yes                                    | enter remote path to repository, e.g., '/mnt/data/repository'                                                                                                                                                                                                          |
| Launch external password-less SSH command | (same)        | `externalSSH` | switch  |                                        | Help: “By default Kopia connects to the server using internal SSH client which supports limited options. Alternatively it may launch external password-less SSH command, which supports additional options, but is generally less efficient than the built-in client.” |

When `externalSSH` is **off**:

| Label                    | Classic label            | Path             | Control            | Placeholder                            |
| ------------------------ | ------------------------ | ---------------- | ------------------ | -------------------------------------- |
| Password                 | Password                 | `password`       | password           | password                               |
| Path to key file         | Path to key file         | `keyfile`        | file path + Browse | enter path to the key file             |
| Key data                 | Key Data                 | `keyData`        | multi-line         | paste contents of the key file         |
| Path to known_hosts file | Path to known_hosts File | `knownHostsFile` | file path + Browse | enter path to the known_hosts file     |
| Known hosts data         | Known Hosts Data         | `knownHostsData` | multi-line         | paste contents of the known_hosts file |

Validation: exactly one of password / key file / key data; exactly one of known_hosts file / known hosts data.

When `externalSSH` is **on**:

| Label         | Classic label | Path           | Control | Placeholder                                                                      |
| ------------- | ------------- | -------------- | ------- | -------------------------------------------------------------------------------- |
| SSH command   | SSH Command   | `sshCommand`   | text    | provide enter passwordless SSH command to execute (typically 'ssh')              |
| SSH arguments | SSH Arguments | `sshArguments` | text    | enter SSH command arguments ('user@host -s sftp' will be appended automatically) |

Native: fix the classic placeholder typo to “passwordless SSH command to run (usually 'ssh')”.

### WebDAV server (`webdav`)

| Label      | Classic label     | Path       | Control  | Required | Placeholder                |
| ---------- | ----------------- | ---------- | -------- | -------- | -------------------------- |
| Server URL | WebDAV Server URL | `url`      | text     | yes      | http[s]://server:port/path |
| Username   | Username          | `username` | text     |          | enter username             |
| Password   | Password          | `password` | password |          | enter password             |

### Rclone remote (`rclone`)

| Label             | Classic label          | Path         | Control            | Required | Placeholder                          |
| ----------------- | ---------------------- | ------------ | ------------------ | -------- | ------------------------------------ |
| Remote path       | Rclone Remote Path     | `remotePath` | text               | yes      | enter <name-of-rclone-remote>:<path> |
| Rclone executable | Rclone Executable Path | `rcloneExe`  | file path + Browse |          | enter path to rclone executable      |

### Kopia repository server (`_server`)

| Label                                     | Classic label                                   | Request path                      | Control | Required | Placeholder                                                            |
| ----------------------------------------- | ----------------------------------------------- | --------------------------------- | ------- | -------- | ---------------------------------------------------------------------- |
| Server address                            | Server address                                  | `apiServer.url`                   | text    | yes      | enter server URL (https://<host>:port)                                 |
| Trusted certificate fingerprint (SHA-256) | Trusted server certificate fingerprint (SHA256) | `apiServer.serverCertFingerprint` | text    |          | enter trusted server certificate fingerprint printed at server startup |

### Repository token (`_token`)

| Label | Classic label | Request path | Control  | Required | Placeholder            |
| ----- | ------------- | ------------ | -------- | -------- | ---------------------- |
| Token | Token         | `token`      | password | yes      | paste connection token |

Required-field errors: “Required” under the field (same wording as notification profiles).

## Notification profiles

Source: `src/app/pages/preferences/NotificationProfiles.tsx`. Request: `NotificationProfile` in [openapi.yaml](../api/openapi.yaml).

Common fields:

| Label            | Help                                             | Control                                                                               | Path                   | Default                         | Validation                                                   |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------- | ------------------------------- | ------------------------------------------------------------ |
| Profile name     | —                                                | Text, read-only when editing                                                          | `profile`              | `{type}-{n}` (`newProfileName`) | required; unique when new: “A profile with this name exists” |
| Minimum severity | Send only notifications at least this important. | Select: “Verbose” (-100), “Success” (-10), “Report” (0), “Warning” (10), “Error” (20) | `minSeverity`          | Report (0)                      | —                                                            |
| Format           | —                                                | Select: “Plain text” (`txt`), “HTML” (`html`)                                         | `method.config.format` | `txt`                           | —                                                            |

E-mail (`email`, defaults `smtpPort: 587`, `format: "txt"`):

| Label         | Path           | Control                    | Required | Placeholder               |
| ------------- | -------------- | -------------------------- | -------- | ------------------------- |
| SMTP server   | `smtpServer`   | text (two thirds wide)     | yes      | smtp.example.com          |
| Port          | `smtpPort`     | number 1–65535, no spinner | yes      |                           |
| Username      | `smtpUsername` | text                       |          | often the e-mail address  |
| Password      | `smtpPassword` | password                   |          |                           |
| From          | `from`         | text                       | yes      | kopia@example.com         |
| To            | `to`           | text                       | yes      | comma-separated addresses |
| CC            | `cc`           | text                       |          | optional                  |
| SMTP identity | `smtpIdentity` | text                       |          | usually empty             |
| Format        | `format`       | select                     |          |                           |

Pushover (`pushover`, default `format: "txt"`):

| Label             | Path       | Control | Required |
| ----------------- | ---------- | ------- | -------- |
| App token         | `appToken` | text    | yes      |
| User or group key | `userKey`  | text    | yes      |
| Format            | `format`   | select  |          |

Webhook (`webhook`, defaults `format: "txt"`, `method: "POST"`):

| Label              | Help                              | Path       | Control                               | Required | Placeholder |
| ------------------ | --------------------------------- | ---------- | ------------------------------------- | -------- | ----------- |
| URL                | —                                 | `endpoint` | text                                  | yes      | https://…   |
| HTTP method        | —                                 | `method`   | select POST / PUT                     |          |             |
| Format             | —                                 | `format`   | select                                |          |             |
| Additional headers | One per line, as “Header: Value”. | `headers`  | multi-line (newline-separated string) |          |             |

Unknown method types show a yellow alert “Unknown notification method “{type}”.” instead of fields.

## Restore dialog

See [screens/source-detail.md](screens/source-detail.md#restore-dialog) for labels and defaults, and `restoreRequest` in [logic.md](logic.md#restore-request) for how they map to `POST restore`.

## Snapshot edit dialog

See [screens/source-detail.md](screens/source-detail.md#snapshot-edit-dialog).
