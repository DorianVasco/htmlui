// Test vectors for docs/ui-spec/test-vectors.json.
//
// Native clients port the UI's pure helpers; this file runs the web UI's own
// implementations against the shared vectors so the spec can't drift from the
// code. Regenerate after changing a helper on purpose:
//   UPDATE_UI_VECTORS=1 npx vitest run tests/app/uiSpecVectors.test.ts
import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sizeDisplayName, formatDuration } from "../../src/utils/formatutils";
import { relativeTime, ownerName } from "../../src/app/format";
import {
  failedCount,
  failureDetails,
  filterByOwner,
  isActive,
  isOverdue,
  needsAttention,
  nextScheduled,
  sourceState,
  totalSize,
  uploadProgress,
} from "../../src/app/sourceStatus";
import {
  cleanPolicy,
  definedSections,
  formatTimeOfDay,
  getPath,
  parsePolicyTarget,
  parseTimeOfDay,
  policyKind,
  sameTarget,
  setPath,
  targetLabel,
} from "../../src/app/pages/policies/policyModel";
import { filterPolicies } from "../../src/app/pages/policies/PoliciesPage";
import { formatInterval } from "../../src/app/pages/policies/PolicyEditor";
import { DEFAULT_RESTORE_OPTIONS, restoreRequest } from "../../src/app/pages/source/RestoreModal";
import { retentionColor } from "../../src/app/pages/source/SourceDetailPage";
import { sortEntries } from "../../src/app/pages/source/SnapshotBrowser";
import { counterRows, isRunning, logLevelColor, logParams } from "../../src/app/pages/tasks/taskFormat";
import { filterTasks } from "../../src/app/pages/tasks/TasksPage";
import { missingFields, newProfileName, severityLabel } from "../../src/app/pages/preferences/NotificationProfiles";
import { cliPolicyTarget, q } from "../../src/app/cli";
import { rememberableStorage, repoId } from "../../src/app/knownRepos";
import { isMissingDirectory } from "../../src/app/storageErrors";
import { ApiError } from "../../src/api";
import type { SourceStatus, Task } from "../../src/api";

const VECTORS = path.resolve(__dirname, "../../docs/ui-spec/test-vectors.json");
const NOW = Date.parse("2026-11-15T12:00:00Z");

type Fn = (...args: never[]) => unknown;
interface Case {
  name: string;
  args: unknown[];
}

const src = (over: Record<string, unknown> = {}, owner = { userName: "me", host: "pc" }) =>
  ({
    source: { ...owner, path: "/data" },
    status: "IDLE",
    lastSnapshot: { startTime: "2026-11-15T10:00:00Z", stats: { totalSize: 100 } },
    nextSnapshotTime: "2026-11-15T13:00:00Z",
    ...over,
  }) as unknown as SourceStatus;

const task = (over: Partial<Task>): Task => ({
  id: "t",
  kind: "Snapshot",
  description: "",
  status: "SUCCESS",
  startTime: "2026-11-15T10:00:00Z",
  ...over,
});

/** Function name → [implementation, cases]. `now`-dependent helpers take NOW explicitly. */
const SUITE: Record<string, [Fn, Case[]]> = {
  sizeDisplayName: [
    sizeDisplayName as Fn,
    [
      { name: "zero", args: [0, false] },
      { name: "below 0.9 K stays bytes", args: [899, false] },
      { name: "900 switches to K", args: [900, false] },
      { name: "1536000 base-10", args: [1536000, false] },
      { name: "1536000 base-2", args: [1536000, true] },
      { name: "rounds to one decimal", args: [1234567, false] },
      { name: "terabytes", args: [5.5e12, false] },
      { name: "beyond T stays T", args: [3e15, false] },
      { name: "undefined", args: [undefined, false] },
    ],
  ],
  relativeTime: [
    relativeTime as Fn,
    [
      { name: "empty", args: ["", NOW] },
      { name: "30 s ago", args: ["2026-11-15T11:59:30Z", NOW] },
      { name: "5 min ago", args: ["2026-11-15T11:55:00Z", NOW] },
      { name: "in 90 min rounds to 2 hours", args: ["2026-11-15T13:30:00Z", NOW] },
      { name: "yesterday", args: ["2026-11-14T12:00:00Z", NOW] },
      { name: "3 days ago", args: ["2026-11-12T11:00:00Z", NOW] },
      { name: "45 days ago: -1.5 months rounds toward +infinity to last month", args: ["2026-10-01T12:00:00Z", NOW] },
      { name: "in 45 days: +1.5 months rounds up to 2 months", args: ["2026-12-30T12:00:00Z", NOW] },
      { name: "90 min ago: -1.5 hours rounds to 1 hour ago", args: ["2026-11-15T10:30:00Z", NOW] },
      { name: "400 days ago is last year", args: ["2025-10-11T12:00:00Z", NOW] },
    ],
  ],
  formatDuration: [
    formatDuration as Fn,
    [
      { name: "no start", args: ["", "2026-11-15T10:00:00Z", true] },
      { name: "negative", args: ["2026-11-15T10:00:05Z", "2026-11-15T10:00:00Z", true] },
      { name: "2.5 s", args: ["2026-11-15T10:00:00.000Z", "2026-11-15T10:00:02.500Z", true] },
      { name: "45 s", args: ["2026-11-15T10:00:00Z", "2026-11-15T10:00:45Z", true] },
      { name: "1 m 5 s", args: ["2026-11-15T10:00:00Z", "2026-11-15T10:01:05Z", true] },
      { name: "exactly 2 m", args: ["2026-11-15T10:00:00Z", "2026-11-15T10:02:00Z", true] },
      { name: "1 h 2 m 3 s", args: ["2026-11-15T10:00:00Z", "2026-11-15T11:02:03Z", true] },
      { name: "1 d 3 h", args: ["2026-11-14T07:00:00Z", "2026-11-15T10:00:00Z", true] },
    ],
  ],
  ownerName: [ownerName as Fn, [{ name: "user@host", args: [{ userName: "me", host: "pc" }] }]],

  sourceState: [
    sourceState as Fn,
    [
      { name: "uploading", args: [src({ status: "UPLOADING" }), NOW] },
      { name: "pending", args: [src({ status: "PENDING" }), NOW] },
      { name: "paused", args: [src({ status: "PAUSED" }), NOW] },
      { name: "never backed up", args: [src({ lastSnapshot: null }), NOW] },
      { name: "overdue", args: [src({ nextSnapshotTime: "2026-11-15T11:00:00Z" }), NOW] },
      { name: "ok", args: [src(), NOW] },
      { name: "manual (no next time) is ok", args: [src({ nextSnapshotTime: null }), NOW] },
      { name: "FAILED status is not special-cased", args: [src({ status: "FAILED" }), NOW] },
      { name: "REMOTE status is not special-cased", args: [src({ status: "REMOTE" }), NOW] },
    ],
  ],
  uploadProgress: [
    uploadProgress as Fn,
    [
      { name: "no upload", args: [src()] },
      {
        name: "70 % of estimate",
        args: [
          src({
            status: "UPLOADING",
            upload: {
              hashedBytes: 512000,
              cachedBytes: 204800,
              estimatedBytes: 1024000,
              hashedFiles: 50,
              cachedFiles: 20,
              directory: "/data/a",
            },
          }),
        ],
      },
      { name: "one decimal", args: [src({ upload: { hashedBytes: 1, estimatedBytes: 3 } })] },
      { name: "estimate exceeded → no percent", args: [src({ upload: { hashedBytes: 2000, estimatedBytes: 1000 } })] },
      { name: "no estimate", args: [src({ upload: { hashedBytes: 10, hashedFiles: 1 } })] },
    ],
  ],
  isOverdue: [
    isOverdue as Fn,
    [
      { name: "past next time", args: [src({ nextSnapshotTime: "2026-11-15T11:00:00Z" }), NOW] },
      { name: "future next time", args: [src(), NOW] },
      {
        name: "uploading is never overdue",
        args: [src({ status: "UPLOADING", nextSnapshotTime: "2026-11-15T11:00:00Z" }), NOW],
      },
      { name: "no next time", args: [src({ nextSnapshotTime: null }), NOW] },
    ],
  ],
  failedCount: [
    failedCount as Fn,
    [
      { name: "none", args: [src()] },
      { name: "two failed", args: [src({ lastSnapshot: { startTime: "x", rootEntry: { summ: { numFailed: 2 } } } })] },
    ],
  ],
  failureDetails: [
    failureDetails as Fn,
    [
      {
        name: "path: error per line",
        args: [
          src({
            lastSnapshot: {
              startTime: "x",
              rootEntry: {
                summ: {
                  numFailed: 2,
                  errors: [
                    { path: "a", error: "denied" },
                    { path: "b", error: "busy" },
                  ],
                },
              },
            },
          }),
        ],
      },
    ],
  ],
  needsAttention: [
    needsAttention as Fn,
    [
      { name: "errors", args: [src({ lastSnapshot: { startTime: "x", rootEntry: { summ: { numFailed: 1 } } } }), NOW] },
      { name: "overdue", args: [src({ nextSnapshotTime: "2026-11-15T11:00:00Z" }), NOW] },
      { name: "fine", args: [src(), NOW] },
    ],
  ],
  isActive: [
    isActive as Fn,
    [
      { name: "uploading", args: [src({ status: "UPLOADING" })] },
      { name: "pending", args: [src({ status: "PENDING" })] },
      { name: "idle", args: [src()] },
    ],
  ],
  totalSize: [
    totalSize as Fn,
    [
      { name: "from last snapshot stats", args: [src()] },
      { name: "never", args: [src({ lastSnapshot: null })] },
    ],
  ],
  nextScheduled: [
    // Returns the source; the vector records its path.
    ((list: SourceStatus[], now: number) => nextScheduled(list, now)?.source.path ?? null) as Fn,
    [
      {
        name: "earliest future, skipping active and past",
        args: [
          [
            {
              ...src({ nextSnapshotTime: "2026-11-15T15:00:00Z" }),
              source: { userName: "me", host: "pc", path: "/late" },
            },
            {
              ...src({ nextSnapshotTime: "2026-11-15T12:30:00Z", status: "UPLOADING" }),
              source: { userName: "me", host: "pc", path: "/active" },
            },
            {
              ...src({ nextSnapshotTime: "2026-11-15T11:00:00Z" }),
              source: { userName: "me", host: "pc", path: "/past" },
            },
            {
              ...src({ nextSnapshotTime: "2026-11-15T13:00:00Z" }),
              source: { userName: "me", host: "pc", path: "/soon" },
            },
          ],
          NOW,
        ],
      },
      { name: "nothing scheduled", args: [[src({ nextSnapshotTime: null })], NOW] },
    ],
  ],
  filterByOwner: [
    ((list: SourceStatus[], owner: string, local: string) =>
      filterByOwner(list, owner, local).map((s) => ownerName(s.source))) as Fn,
    [
      { name: "local", args: [[src(), src({}, { userName: "bob", host: "nas" })], "__local", "me@pc"] },
      { name: "all", args: [[src(), src({}, { userName: "bob", host: "nas" })], "__all", "me@pc"] },
      { name: "specific owner", args: [[src(), src({}, { userName: "bob", host: "nas" })], "bob@nas", "me@pc"] },
    ],
  ],

  policyKind: [
    policyKind as Fn,
    [
      { name: "global", args: [{ userName: "", host: "", path: "" }] },
      { name: "host", args: [{ userName: "", host: "pc", path: "" }] },
      { name: "user", args: [{ userName: "me", host: "pc", path: "" }] },
      { name: "directory", args: [{ userName: "me", host: "pc", path: "/data" }] },
    ],
  ],
  targetLabel: [
    targetLabel as Fn,
    [
      { name: "global", args: [{}] },
      { name: "host", args: [{ host: "pc" }] },
      { name: "user", args: [{ userName: "me", host: "pc" }] },
      { name: "directory", args: [{ userName: "me", host: "pc", path: "C:\\Data" }] },
    ],
  ],
  sameTarget: [
    sameTarget as Fn,
    [
      { name: "missing parts equal empty", args: [{ host: "pc" }, { userName: "", host: "pc", path: "" }] },
      { name: "different", args: [{ host: "pc" }, { host: "nas" }] },
    ],
  ],
  parsePolicyTarget: [
    parsePolicyTarget as Fn,
    [
      { name: "empty", args: ["  ", { userName: "me", host: "pc" }] },
      { name: "unix path", args: ["/home/me/Documents", { userName: "me", host: "pc" }] },
      { name: "windows path", args: ["C:\\Data", { userName: "me", host: "pc" }] },
      { name: "UNC path", args: ["\\\\nas\\share", { userName: "me", host: "pc" }] },
      { name: "@host", args: ["@nas", { userName: "me", host: "pc" }] },
      { name: "user@host", args: ["bob@nas", { userName: "me", host: "pc" }] },
      { name: "user@host:path", args: ["bob@nas:/srv", { userName: "me", host: "pc" }] },
      { name: "relative path", args: ["Documents", { userName: "me", host: "pc" }] },
      { name: "missing host", args: ["bob@", { userName: "me", host: "pc" }] },
      { name: "folder without user", args: ["@nas:/srv", { userName: "me", host: "pc" }] },
      { name: "relative folder", args: ["bob@nas:srv", { userName: "me", host: "pc" }] },
    ],
  ],
  getPath: [
    getPath as Fn,
    [
      { name: "nested", args: [{ a: { b: 2 } }, "a.b"] },
      { name: "missing", args: [{ a: 1 }, "a.b"] },
    ],
  ],
  setPath: [
    setPath as Fn,
    [
      { name: "creates parents", args: [{}, "retention.keepDaily", 7] },
      {
        name: "undefined removes and prunes empty parents",
        args: [{ retention: { keepDaily: 7 } }, "retention.keepDaily", undefined],
      },
      {
        name: "keeps siblings",
        args: [{ retention: { keepDaily: 7, keepLatest: 3 } }, "retention.keepDaily", undefined],
      },
    ],
  ],
  definedSections: [
    definedSections as Fn,
    [
      { name: "empty", args: [{}] },
      {
        name: "sections in key order, noParent last",
        args: [{ noParent: true, scheduling: { manual: true }, retention: { keepDaily: 1 } }],
      },
      {
        name: "empty section is not listed",
        args: [{ files: { ignore: [] }, compression: { compressorName: "zstd" } }],
      },
      { name: "unknown key uses its name", args: [{ custom: { x: 1 } }] },
    ],
  ],
  cleanPolicy: [
    cleanPolicy as Fn,
    [
      { name: "trims and drops blank list entries", args: [{ files: { ignore: [" *.tmp ", "", "  "] } }] },
      { name: "all-blank list is removed", args: [{ scheduling: { cron: [""] } }] },
      {
        name: "action without script is removed",
        args: [{ actions: { beforeFolder: { script: "  ", timeout: 10 } } }],
      },
      { name: "action timeout defaults to 300", args: [{ actions: { afterSnapshotRoot: { script: "echo hi" } } }] },
      { name: "explicit timeout kept", args: [{ actions: { afterSnapshotRoot: { script: "x", timeout: 5 } } }] },
    ],
  ],
  parseTimeOfDay: [
    parseTimeOfDay as Fn,
    [
      { name: "02:00", args: ["02:00"] },
      { name: "single-digit hour", args: ["7:05"] },
      { name: "trims", args: [" 23:59 "] },
      { name: "hour 24 invalid", args: ["24:00"] },
      { name: "minute 60 invalid", args: ["12:60"] },
      { name: "missing minutes", args: ["12"] },
    ],
  ],
  formatTimeOfDay: [formatTimeOfDay as Fn, [{ name: "pads", args: [{ hour: 7, min: 5 }] }]],
  formatInterval: [
    formatInterval as Fn,
    [
      { name: "known hour", args: [3600] },
      { name: "known 10 min", args: [600] },
      { name: "custom", args: [5400] },
    ],
  ],
  filterPolicies: [
    ((list: unknown[], scope: string, local: unknown, query: string) =>
      filterPolicies(list as never, scope as never, local as never, query).map((p) => targetLabel(p.target))) as Fn,
    [
      {
        name: "local scope, ordered by kind then label",
        args: [
          [
            { target: { userName: "me", host: "pc", path: "/b" }, policy: {} },
            { target: { userName: "bob", host: "nas", path: "/x" }, policy: {} },
            { target: { userName: "", host: "pc", path: "" }, policy: {} },
            { target: { userName: "me", host: "pc", path: "/a" }, policy: {} },
            { target: { userName: "", host: "", path: "" }, policy: {} },
            { target: { userName: "me", host: "pc", path: "" }, policy: {} },
            { target: { userName: "other", host: "pc", path: "/o" }, policy: {} },
          ],
          "local",
          { userName: "me", host: "pc" },
          "",
        ],
      },
      {
        name: "all scope with query",
        args: [
          [
            { target: { userName: "me", host: "pc", path: "/a" }, policy: {} },
            { target: { userName: "bob", host: "nas", path: "/x" }, policy: {} },
          ],
          "all",
          { userName: "me", host: "pc" },
          "NAS",
        ],
      },
    ],
  ],

  restoreRequest: [
    restoreRequest as Fn,
    [
      { name: "folder with defaults", args: ["kabc", " /restore/here ", DEFAULT_RESTORE_OPTIONS] },
      { name: "zip (case-insensitive)", args: ["kabc", "/tmp/out.ZIP", DEFAULT_RESTORE_OPTIONS] },
      { name: "tar", args: ["kabc", "/tmp/out.tar", DEFAULT_RESTORE_OPTIONS] },
      {
        name: "overwrite, skip metadata, continue on errors",
        args: [
          "kabc",
          "D:\\r",
          {
            overwrite: true,
            restorePermissions: false,
            restoreOwners: false,
            restoreTimes: false,
            continueOnErrors: true,
            incremental: false,
          },
        ],
      },
    ],
  ],
  retentionColor: [
    retentionColor as Fn,
    ["latest-1", "hourly-2", "daily-3", "weekly-1", "monthly-4", "annual-1", "pinned"].map((r) => ({
      name: r,
      args: [r],
    })),
  ],
  sortEntries: [
    ((entries: never[]) => sortEntries(entries).map((e: { name: string }) => e.name)) as Fn,
    [
      {
        name: "folders first, then by name",
        args: [
          [
            { name: "b.txt", type: "f", obj: "1" },
            { name: "zeta", type: "d", obj: "2" },
            { name: "a.txt", type: "f", obj: "3" },
            { name: "alpha", type: "d", obj: "4" },
          ],
        ],
      },
    ],
  ],

  isRunning: [
    isRunning as Fn,
    ["RUNNING", "CANCELING", "SUCCESS", "FAILED", "CANCELED"].map((s) => ({ name: s, args: [task({ status: s })] })),
  ],
  filterTasks: [
    ((tasks: Task[], status: string, kind: string | null) =>
      filterTasks(tasks, status as never, kind).map((t) => t.id)) as Fn,
    [
      {
        name: "all: running first, then newest",
        args: [
          [
            task({ id: "old", startTime: "2026-11-15T08:00:00Z" }),
            task({ id: "new", startTime: "2026-11-15T11:00:00Z", status: "FAILED" }),
            task({ id: "run", startTime: "2026-11-15T07:00:00Z", status: "RUNNING" }),
            task({ id: "canc", startTime: "2026-11-15T06:00:00Z", status: "CANCELING", kind: "Restore" }),
          ],
          "all",
          null,
        ],
      },
      {
        name: "running includes CANCELING",
        args: [
          [task({ id: "a", status: "RUNNING" }), task({ id: "b", status: "CANCELING" }), task({ id: "c" })],
          "running",
          null,
        ],
      },
      { name: "failed", args: [[task({ id: "a", status: "FAILED" }), task({ id: "c" })], "failed", null] },
      { name: "kind", args: [[task({ id: "a", kind: "Restore" }), task({ id: "c" })], "all", "Restore"] },
    ],
  ],
  counterRows: [
    counterRows as Fn,
    [
      {
        name: "drops zero, errors first, bytes formatted",
        args: [
          {
            "Hashed Files": { value: 12, level: "" },
            "Hashed Bytes": { value: 1536000, units: "bytes", level: "" },
            Errors: { value: 2, level: "error" },
            Warnings: { value: 0, level: "warning" },
            "Ignored Errors": { value: 1, level: "warning" },
            Notice: { value: 3, level: "notice" },
          },
          false,
        ],
      },
    ],
  ],
  logLevelColor: [logLevelColor as Fn, [0, 1, 2, 3].map((l) => ({ name: "level " + l, args: [l] }))],
  logParams: [
    logParams as Fn,
    [
      { name: "no extras", args: [{ ts: 1, level: 1, mod: "m", msg: "hi" }] },
      { name: "extras as JSON", args: [{ ts: 1, level: 1, mod: "m", msg: "hi", path: "/a", n: 2 }] },
    ],
  ],

  newProfileName: [
    newProfileName as Fn,
    [
      { name: "first", args: ["email", []] },
      { name: "skips taken", args: ["email", [{ profile: "email-1" }, { profile: "email-3" }]] },
    ],
  ],
  missingFields: [
    missingFields as Fn,
    [
      { name: "email all missing", args: [{ profile: "x", method: { type: "email", config: { smtpPort: 587 } } }] },
      {
        name: "whitespace counts as missing",
        args: [{ profile: "x", method: { type: "webhook", config: { endpoint: "  " } } }],
      },
      {
        name: "pushover complete",
        args: [{ profile: "x", method: { type: "pushover", config: { appToken: "a", userKey: "b" } } }],
      },
      { name: "unknown method", args: [{ profile: "x", method: { type: "sms", config: {} } }] },
    ],
  ],
  severityLabel: [
    severityLabel as Fn,
    [-100, -10, 0, 10, 20, 5, undefined].map((s) => ({ name: String(s), args: [s] })),
  ],

  cliPolicyTarget: [
    cliPolicyTarget as Fn,
    [
      { name: "global", args: [{}] },
      { name: "host", args: [{ host: "pc" }] },
      { name: "user", args: [{ userName: "me", host: "pc" }] },
      { name: "directory", args: [{ userName: "me", host: "pc", path: "/data" }] },
      { name: "directory with space", args: [{ userName: "me", host: "pc", path: "C:\\My Data" }] },
    ],
  ],
  q: [
    q as Fn,
    [
      { name: "plain", args: ["/home/me/docs"] },
      { name: "windows path", args: ["C:\\Data"] },
      { name: "space", args: ["My Docs"] },
      { name: "quote", args: ['say "hi"'] },
    ],
  ],
  repoId: [repoId as Fn, [{ name: "type:path", args: ["filesystem", "/backup"] }]],
  rememberableStorage: [
    rememberableStorage as Fn,
    [
      { name: "filesystem", args: [{ type: "filesystem", config: { path: "/backup", extra: 1 } }] },
      { name: "filesystem without path", args: [{ type: "filesystem", config: { path: "" } }] },
      { name: "s3 never remembered", args: [{ type: "s3", config: { bucket: "b" } }] },
    ],
  ],
  isMissingDirectory: [
    ((message: string, code: string) => isMissingDirectory(new ApiError(message, 500, code))) as Fn,
    [
      {
        name: "windows",
        args: [
          "internal server error: cannot access storage path: CreateFile D:\\x: The system cannot find the file specified.",
          "INTERNAL",
        ],
      },
      { name: "unix", args: ["cannot access storage path: stat /x: no such file or directory", "INTERNAL"] },
      { name: "other storage error", args: ["cannot access storage path: permission denied", "INTERNAL"] },
    ],
  ],
};

// JSON can't hold undefined: store it as {"$undefined": true}.
const enc = (v: unknown) =>
  JSON.parse(
    JSON.stringify(v === undefined ? { $undefined: true } : v, (_k, x) => (x === undefined ? { $undefined: true } : x)),
  );

function compute() {
  const out: Record<string, { name: string; args: unknown[]; result: unknown }[]> = {};
  for (const [fn, [impl, cases]] of Object.entries(SUITE)) {
    out[fn] = cases.map((c) => ({ name: c.name, args: enc(c.args), result: enc(impl(...(c.args as never[]))) }));
  }
  return out;
}

describe("UI spec test vectors", () => {
  const actual = compute();

  if (process.env.UPDATE_UI_VECTORS) {
    fs.writeFileSync(
      VECTORS,
      JSON.stringify(
        {
          $comment:
            'Generated by tests/app/uiSpecVectors.test.ts from the web UI\'s implementations. Times use now = 2026-11-15T12:00:00Z. {"$undefined": true} stands for undefined. See docs/ui-spec/logic.md.',
          now: "2026-11-15T12:00:00Z",
          functions: actual,
        },
        null,
        2,
      ) + "\n",
    );
  }

  const expected = JSON.parse(fs.readFileSync(VECTORS, "utf8")).functions;
  for (const fn of Object.keys(SUITE)) {
    test(fn, () => {
      expect(actual[fn]).toEqual(expected[fn]);
    });
  }
});

// docs/ui-spec/strings.json must only contain text the UI actually shows.
describe("UI spec strings", () => {
  test("every catalog string occurs in src/app", () => {
    const appDir = path.resolve(__dirname, "../../src/app");
    const files = (fs.readdirSync(appDir, { recursive: true }) as string[]).filter(
      (f) => /\.tsx?$/.test(f) && !f.includes("devMock"),
    );
    // JS literals write "\" as "\\"; JSX wraps text over lines and in <b>/<code>.
    const source = files
      .map((f) => fs.readFileSync(path.join(appDir, f), "utf8"))
      .join("\n")
      .replace(/\\\\/g, "\\")
      .replace(/<\/?(code|b)>/g, "")
      .replace(/\s+/g, " ");
    const catalog = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../docs/ui-spec/strings.json"), "utf8"),
    ) as Record<string, Record<string, string> | string>;

    const missing: string[] = [];
    for (const [section, items] of Object.entries(catalog)) {
      if (section.startsWith("$") || typeof items === "string") continue;
      for (const [key, text] of Object.entries(items)) {
        for (const fragment of text.split(/\{[^}]+\}|\*\*/)) {
          const f = fragment.trim().replace(/\s+/g, " ");
          if (f && !source.includes(f)) missing.push(`${section}.${key}: ${f}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
