import { describe, expect, test } from "vitest";
import type { SourceStatus } from "../../src/api";
import {
  ALL_OWNERS,
  failedCount,
  filterByOwner,
  isOverdue,
  LOCAL_OWNER,
  needsAttention,
  nextScheduled,
  sourceState,
  uploadProgress,
} from "../../src/app/sourceStatus";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const src = (over: Partial<SourceStatus> = {}, owner = { userName: "me", host: "pc" }): SourceStatus => ({
  source: { ...owner, path: "/data" },
  status: "IDLE",
  lastSnapshot: { startTime: "2026-11-15T10:00:00Z", stats: { totalSize: 100 } },
  nextSnapshotTime: "2026-11-15T13:00:00Z",
  ...over,
});

describe("uploadProgress", () => {
  test("counts hashed + cached bytes against the estimate, like the old UI", () => {
    const p = uploadProgress(src({ status: "UPLOADING", upload: { hashedBytes: 512000, cachedBytes: 204800, estimatedBytes: 1024000, hashedFiles: 50, cachedFiles: 20 } }));
    expect(p?.doneBytes).toBe(716800);
    expect(p?.percent).toBe(70);
    expect(p?.files).toBe(70);
  });

  test("has no percentage without an estimate or above 100%", () => {
    expect(uploadProgress(src({ upload: { hashedBytes: 10 } }))?.percent).toBeUndefined();
    expect(uploadProgress(src({ upload: { hashedBytes: 300, estimatedBytes: 100 } }))?.percent).toBeUndefined();
    expect(uploadProgress(src({ upload: null }))).toBeUndefined();
  });
});

describe("sourceState", () => {
  test("maps server status and snapshot age", () => {
    expect(sourceState(src({ status: "UPLOADING" }), NOW)).toBe("uploading");
    expect(sourceState(src({ status: "PENDING" }), NOW)).toBe("pending");
    expect(sourceState(src({ status: "PAUSED" }), NOW)).toBe("paused");
    expect(sourceState(src({ lastSnapshot: null }), NOW)).toBe("never");
    expect(sourceState(src({ nextSnapshotTime: "2026-11-15T11:00:00Z" }), NOW)).toBe("overdue");
    expect(sourceState(src(), NOW)).toBe("ok");
  });

  test("a running upload is never overdue", () => {
    expect(isOverdue(src({ status: "UPLOADING", nextSnapshotTime: "2026-11-15T11:00:00Z" }), NOW)).toBe(false);
  });
});

describe("attention and scheduling", () => {
  test("failed entries come from rootEntry.summ.numFailed", () => {
    const s = src({ lastSnapshot: { startTime: "2026-11-15T10:00:00Z", rootEntry: { summ: { numFailed: 2 } } } });
    expect(failedCount(s)).toBe(2);
    expect(needsAttention(s, NOW)).toBe(true);
    expect(needsAttention(src(), NOW)).toBe(false);
  });

  test("nextScheduled picks the earliest future time of idle sources", () => {
    const a = src({ nextSnapshotTime: "2026-11-15T15:00:00Z" });
    const b = src({ nextSnapshotTime: "2026-11-15T12:30:00Z" });
    const past = src({ nextSnapshotTime: "2026-11-15T11:00:00Z" });
    const running = src({ status: "UPLOADING", nextSnapshotTime: "2026-11-15T12:05:00Z" });
    expect(nextScheduled([a, b, past, running], NOW)).toBe(b);
    expect(nextScheduled([], NOW)).toBeUndefined();
  });
});

test("filterByOwner supports local, all and a specific owner", () => {
  const mine = src();
  const other = src({}, { userName: "root", host: "nas" });
  expect(filterByOwner([mine, other], LOCAL_OWNER, "me@pc")).toEqual([mine]);
  expect(filterByOwner([mine, other], ALL_OWNERS, "me@pc")).toEqual([mine, other]);
  expect(filterByOwner([mine, other], "root@nas", "me@pc")).toEqual([other]);
});
