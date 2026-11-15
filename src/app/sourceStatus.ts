// Pure helpers that interpret /api/v1/sources entries, mirroring the old
// Snapshots page so both UIs agree on what a source's state means.
import type { SourceStatus } from "../api";

export type SourceState = "uploading" | "pending" | "paused" | "never" | "overdue" | "ok";

export interface UploadProgress {
  /** Bytes processed so far (hashed + cached), like the old UI. */
  doneBytes: number;
  estimatedBytes?: number;
  /** 0–100, or undefined when there is no estimate (or it is exceeded). */
  percent?: number;
  files: number;
  directory?: string;
}

export function uploadProgress(s: SourceStatus): UploadProgress | undefined {
  const u = s.upload;
  if (!u) return undefined;
  const doneBytes = (u.hashedBytes ?? 0) + (u.cachedBytes ?? 0);
  let percent: number | undefined;
  if (u.estimatedBytes) {
    const p = Math.round((doneBytes * 1000) / u.estimatedBytes) / 10;
    if (p <= 100) percent = p;
  }
  return {
    doneBytes,
    estimatedBytes: u.estimatedBytes || undefined,
    percent,
    files: (u.hashedFiles ?? 0) + (u.cachedFiles ?? 0),
    directory: u.directory,
  };
}

export function isOverdue(s: SourceStatus, now: number = Date.now()): boolean {
  return !!s.nextSnapshotTime && s.status !== "UPLOADING" && new Date(s.nextSnapshotTime).valueOf() < now;
}

/** Number of entries that failed in the last snapshot. */
export function failedCount(s: SourceStatus): number {
  return s.lastSnapshot?.rootEntry?.summ?.numFailed ?? 0;
}

export function failureDetails(s: SourceStatus): string {
  const errs = s.lastSnapshot?.rootEntry?.summ?.errors ?? [];
  return errs.map((e) => e.path + ": " + e.error).join("\n");
}

export function sourceState(s: SourceStatus, now: number = Date.now()): SourceState {
  if (s.status === "UPLOADING") return "uploading";
  if (s.status === "PENDING") return "pending";
  if (s.status === "PAUSED") return "paused";
  if (!s.lastSnapshot) return "never";
  if (isOverdue(s, now)) return "overdue";
  return "ok";
}

export function isActive(s: SourceStatus): boolean {
  return s.status === "UPLOADING" || s.status === "PENDING";
}

export function totalSize(s: SourceStatus): number {
  return s.lastSnapshot?.stats?.totalSize ?? 0;
}

/** Earliest upcoming scheduled snapshot among idle sources. */
export function nextScheduled(sources: SourceStatus[], now: number = Date.now()): SourceStatus | undefined {
  return sources
    .filter((s) => s.nextSnapshotTime && !isActive(s) && new Date(s.nextSnapshotTime).valueOf() >= now)
    .sort((a, b) => new Date(a.nextSnapshotTime as string).valueOf() - new Date(b.nextSnapshotTime as string).valueOf())[0];
}

export function needsAttention(s: SourceStatus, now: number = Date.now()): boolean {
  return failedCount(s) > 0 || isOverdue(s, now);
}

export const LOCAL_OWNER = "__local";
export const ALL_OWNERS = "__all";

export function filterByOwner(sources: SourceStatus[], owner: string, localOwner: string): SourceStatus[] {
  if (owner === ALL_OWNERS) return sources;
  const want = owner === LOCAL_OWNER ? localOwner : owner;
  return sources.filter((s) => s.source.userName + "@" + s.source.host === want);
}
