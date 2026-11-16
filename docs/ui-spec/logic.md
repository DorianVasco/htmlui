# Logic catalog

Every client-side rule the UI applies to server data. Both native clients implement these and test them against [test-vectors.json](test-vectors.json).

## Test vectors

`test-vectors.json` holds, for each function below, a list of `{name, args, result}`. It is **generated from the web UI's own implementations** by `tests/app/uiSpecVectors.test.ts`, and that test fails when the code and the file disagree.

- Time-dependent functions take `now = 2026-11-15T12:00:00Z` as an explicit argument.
- `{"$undefined": true}` stands for JavaScript `undefined` (absent value / no result).
- Outputs that depend on the OS locale or time zone (absolute times, log timestamps, `toLocaleString` of large numbers) are **not** in the vectors. Their rules are described below.
- Regenerate after an intentional change: `UPDATE_UI_VECTORS=1 npx vitest run tests/app/uiSpecVectors.test.ts`, then `npx prettier --write docs/ui-spec/test-vectors.json`.

Native test harness: load the JSON, map each function name to the native implementation, convert `args` to native types, compare with `result`. For functions that return objects, compare structurally.

**Rounding.** Every “round” below is JavaScript `Math.round`: halves go toward +∞ (`2.5 → 3`, `−1.5 → −1`). C# `Math.Round` (banker's rounding) and Swift's `.rounded()` (halves away from zero) differ. Use `Math.Floor(x + 0.5)` in C# and `(x + 0.5).rounded(.down)` in Swift.

| Function                                                                                                                                                    | In vectors        | Source                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `sizeDisplayName`                                                                                                                                           | yes               | `src/utils/formatutils.js`                                                                     |
| `relativeTime`                                                                                                                                              | yes               | `src/app/format.ts`                                                                            |
| `absoluteTime`                                                                                                                                              | no (locale)       | `src/app/format.ts`                                                                            |
| `formatDuration`                                                                                                                                            | yes               | `src/utils/formatutils.js`                                                                     |
| `ownerName`                                                                                                                                                 | yes               | `src/app/format.ts`                                                                            |
| `sourceState`, `uploadProgress`, `isOverdue`, `failedCount`, `failureDetails`, `needsAttention`, `isActive`, `totalSize`, `nextScheduled`, `filterByOwner`  | yes               | `src/app/sourceStatus.ts`                                                                      |
| `policyKind`, `targetLabel`, `sameTarget`, `parsePolicyTarget`, `getPath`, `setPath`, `definedSections`, `cleanPolicy`, `parseTimeOfDay`, `formatTimeOfDay` | yes               | `src/app/pages/policies/policyModel.ts`                                                        |
| `filterPolicies`                                                                                                                                            | yes               | `PoliciesPage.tsx`                                                                             |
| `formatInterval`                                                                                                                                            | yes               | `PolicyEditor.tsx`                                                                             |
| `restoreRequest`                                                                                                                                            | yes               | `RestoreModal.tsx`                                                                             |
| `retentionColor`                                                                                                                                            | yes               | `SourceDetailPage.tsx`                                                                         |
| `sortEntries`                                                                                                                                               | yes               | `SnapshotBrowser.tsx`                                                                          |
| `isRunning`, `counterRows`, `logLevelColor`, `logParams`                                                                                                    | yes               | `taskFormat.tsx`                                                                               |
| `logTime`                                                                                                                                                   | no (time zone)    | `taskFormat.tsx`                                                                               |
| `filterTasks`                                                                                                                                               | yes               | `TasksPage.tsx`                                                                                |
| `newProfileName`, `missingFields`, `severityLabel`                                                                                                          | yes               | `NotificationProfiles.tsx`                                                                     |
| `cliPolicyTarget`, `q`                                                                                                                                      | yes               | `src/app/cli.tsx`                                                                              |
| `repoId`, `rememberableStorage`                                                                                                                             | yes               | `src/app/knownRepos.ts` (web repository model only)                                            |
| `isMissingDirectory`                                                                                                                                        | yes               | `src/app/storageErrors.ts`                                                                     |
| `scheduleSummary`, `retentionSummary`, `compressionSummary`, `ignoreSummary`                                                                                | no (not exported) | `NewSnapshotPage.tsx`, rules in [new-snapshot.md](screens/new-snapshot.md#policy-preview-card) |
| `errorText` (setup), `connectErrorText` (switch)                                                                                                            | no (not exported) | rules in [repository.md](screens/repository.md)                                                |

## Formatting

### sizeDisplayName(bytes, base2)

- `undefined` → “”.
- Divide by 1000 (or 1024 when `base2`) while the value is ≥ 0.9 × the divisor, through the units `B, KB, MB, GB, TB` (`B, KiB, MiB, GiB, TiB`).
- Round to one decimal, dropping a trailing “.0”: `1536000` → “1.5 MB”, `899` → “899 B”, `900` → “0.9 KB”.
- Divergence D5: values beyond TB are divided once too often (3 PB → “3 TB”). Native: stop dividing at TB (“3000 TB”). The vector records the web behaviour; skip that one case natively.

### relativeTime(iso, now)

Empty input → “”. Otherwise `diff = time − now`; pick the first unit whose length ≤ |diff|: year (365 d), month (30 d), day, hour, minute; round `diff / unit` (halves toward +∞, so 45 days ago is “last month” but in 45 days is “in 2 months”) and format with an English relative-time formatter in “auto” mode (“yesterday”, “last month”, “in 2 hours”, “5 minutes ago”). Under a minute → “just now”.

Native: Windows has no built-in equivalent with “auto” wording; implement the table directly (or with ICU's `RelativeDateTimeFormatter`). macOS: `RelativeDateTimeFormatter` with `dateTimeStyle = .named` gives the same strings for English. Follow the vectors.

### absoluteTime(iso)

The OS's default short date + medium time in the local time zone. Empty input → “”.

### formatDuration(from, to, multipleUnits = true)

Empty `from` or negative duration → “”. `to` defaults to now. Split into days, hours, minutes, seconds, ms. Output the non-zero of d / h / m in order (abbreviated `d`, `h`, `m`, separated by spaces), then seconds if non-zero or nothing else was output; under 10 s with nothing larger, show one decimal (`2.5s`), otherwise whole seconds (`45s`). Examples: “1m 5s”, “2m”, “1h 2m 3s”, “1d 3h”.

### Counts

Thousands separators from the user's locale.

### logTime(ts)

Unix seconds → local `HH:MM:SS.mmm`, zero-padded.

## Sources

`SourceStatus` comes from `GET sources`.

- **isActive** = status `UPLOADING` or `PENDING`.
- **isOverdue(now)** = has `nextSnapshotTime`, status isn't `UPLOADING`, and `nextSnapshotTime < now`.
- **sourceState(now)**, first match: `UPLOADING` → `uploading`; `PENDING` → `pending`; `PAUSED` → `paused`; no `lastSnapshot` → `never`; overdue → `overdue`; else `ok`. Statuses `FAILED`, `REMOTE` and `IDLE` fall through (divergence D1).
- **uploadProgress**: none without `upload`. `doneBytes = hashedBytes + cachedBytes`, `files = hashedFiles + cachedFiles`, `estimatedBytes` (absent if 0), `percent = round(doneBytes × 1000 / estimatedBytes) / 10` only if there is an estimate and the result is ≤ 100, `directory`.
- **failedCount** = `lastSnapshot.rootEntry.summ.numFailed` or 0. **failureDetails** = `summ.errors` as “{path}: {error}” lines.
- **needsAttention(now)** = `failedCount > 0` or overdue.
- **totalSize** = `lastSnapshot.stats.totalSize` or 0.
- **nextScheduled(list, now)** = among sources with a `nextSnapshotTime ≥ now` that aren't active, the one with the earliest time.
- **filterByOwner(list, owner, localOwner)**: `__all` → all; `__local` → sources whose `user@host` equals `localOwner`; anything else → sources whose `user@host` equals it.

## Policies

- **policyKind**: no host and no user → global; no user → host; no path → user; else directory.
- **targetLabel**: “Global policy”, “@{host}”, “{user}@{host}”, or the path.
- **sameTarget**: compares all three parts, treating missing as “”.
- **parsePolicyTarget(input, local)** (trimmed):
  - empty → error “Enter a folder path, user@computer or @computer.”
  - absolute path (`/…`, `X:\…`, `\\…`) → directory for the local user and host
  - no “@” → error “Relative paths can't have policies. Enter a full path like C:\Data or /home/me.”
  - split at the first “@” and the first “:” after it. Empty host → “A computer name is required after “@”.”
  - no “:” → `{user, host, path: ""}` (user may be empty → host policy)
  - with “:”: empty user → “A user name is required before “@” for a folder policy.”; non-absolute path → “The folder after “:” must be a full path.”
- **getPath / setPath**: dotted paths into the definition. `setPath(…, undefined)` deletes the key and removes parents that become empty.
- **definedSections**: top-level keys with content (non-empty object/array or any scalar), mapped to labels Retention, Schedule (`scheduling`), Files, Errors (`errorHandling`), Compression, Metadata compression, Splitter, Upload, Actions, Logging, OS snapshots (`osSnapshots`); unknown keys keep their name; `noParent` adds “No inheritance” at the end.
- **cleanPolicy** (before preview and save): deep copy; for `files.ignore`, `files.ignoreDotFiles`, `compression.onlyCompress`, `compression.neverCompress`, `scheduling.cron`: trim entries, drop empty ones, remove the list if nothing is left. For each of the four actions: remove it if the script is blank; else set `timeout` to 300 if missing.
- **parseTimeOfDay**: `H:MM` or `HH:MM`, hour < 24, minute < 60; else invalid. **formatTimeOfDay**: zero-padded `HH:MM`.
- **formatInterval**: the label of a known interval, else “every {seconds / 60} minutes”.
- **filterPolicies(list, scope, local, query)**: scope `local` keeps global, host = local host with no user, and user/folder policies of local user on local host; query matches label, user or host (case-insensitive); sort by kind (global, host, user, directory), then label.

## Snapshots and restore

- **retentionColor(reason)** by prefix: latest teal, hourly cyan, daily blue, weekly indigo, monthly grape, else pink.
- **sortEntries**: directories (`type == "d"`) first, then by name (locale compare).

### Restore request

**restoreRequest(oid, destination, options)**, destination trimmed:

```json
{
  "root": "<oid>",
  "options": {
    "incremental": <options.incremental>,
    "ignoreErrors": <options.continueOnErrors>,
    "restoreDirEntryAtDepth": 1000,
    "minSizeForPlaceholder": 0
  }
}
```

plus, by destination:

- ends with `.zip` (any case) → `zipFile: destination, uncompressedZip: true`
- ends with `.tar` (any case) → `tarFile: destination`
- otherwise → `fsOutput: {targetPath, skipOwners: !restoreOwners, skipPermissions: !restorePermissions, skipTimes: !restoreTimes, ignorePermissionErrors: true, overwriteFiles: overwrite, overwriteDirectories: overwrite, overwriteSymlinks: overwrite, writeFilesAtomically: false, writeSparseFiles: false}`

Defaults: overwrite off, restore permissions/owners/times on, continue on errors off, incremental on.

## Tasks

- **isRunning** = `RUNNING` or `CANCELING`.
- **filterTasks(tasks, status, kind)**: status `running` → isRunning; `failed` → `FAILED`; then kind; sort running first, then newest start.
- **counterRows(counters, base2)**: drop values ≤ 0; sort by level (error, warning, notice, other), then name; value = size when `units == "bytes"`, else number with separators.
- **logLevelColor**: ≥ 3 red, 2 orange, else none.
- **logParams(entry)**: all keys except `msg`, `ts`, `level`, `mod`, as compact JSON; “” if none.

## Notifications

- **newProfileName(type, existing)**: first `{type}-{n}` (n = 1, 2, …) not in use.
- **missingFields(profile)**: required config keys whose value is missing or blank after trimming. Required: e-mail `smtpServer, smtpPort, from, to`; Pushover `appToken, userKey`; webhook `endpoint`; unknown types none.
- **severityLabel(n)**: −100 Verbose, −10 Success, 0 Report, 10 Warning, 20 Error; missing → Report; other numbers → “Unknown”.

## CLI equivalents

- **q(arg)**: unchanged if it only contains letters, digits, `_ @ : . / \ -`; otherwise wrapped in double quotes with inner `"` escaped as `\"`.
- **cliPolicyTarget**: global → `--global`, host → `@{host}`, user → `{user}@{host}`, directory → `q("{user}@{host}:{path}")`.

## Errors

- **isMissingDirectory(err)**: an API error whose message matches “cannot access storage path” and either “cannot find the file/path specified” or “no such file or directory” (case-insensitive). The server has no error code for this.
