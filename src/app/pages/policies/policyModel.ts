// Policy helpers: targets, nested field access and the cleanup the server expects.
import type { PolicyTarget } from "../../../api";

export type Policy = Record<string, unknown>;

export type PolicyKind = "global" | "host" | "user" | "directory";

export function policyKind(t: PolicyTarget): PolicyKind {
  if (!t.host && !t.userName) return "global";
  if (!t.userName) return "host";
  if (!t.path) return "user";
  return "directory";
}

export const KIND_INFO: Record<PolicyKind, { label: string; color: string; order: number }> = {
  global: { label: "Global", color: "teal", order: 0 },
  host: { label: "Computer", color: "blue", order: 1 },
  user: { label: "User", color: "indigo", order: 2 },
  directory: { label: "Folder", color: "grape", order: 3 },
};

/** Short name of a target: "Global policy", "@host", "user@host" or the folder path. */
export function targetLabel(t: PolicyTarget): string {
  switch (policyKind(t)) {
    case "global":
      return "Global policy";
    case "host":
      return "@" + t.host;
    case "user":
      return `${t.userName}@${t.host}`;
    default:
      return t.path ?? "";
  }
}

export const sameTarget = (a: PolicyTarget, b: PolicyTarget) =>
  (a.userName ?? "") === (b.userName ?? "") && (a.host ?? "") === (b.host ?? "") && (a.path ?? "") === (b.path ?? "");

/** Route path of the policy editor (same URL as the old UI). */
export function policyEditorPath(t: PolicyTarget): string {
  const q = new URLSearchParams({ userName: t.userName ?? "", host: t.host ?? "", path: t.path ?? "" });
  return "/policies/edit?" + q.toString();
}

function isAbsolutePath(p: string): boolean {
  return p.startsWith("/") || /^[A-Za-z]:\\/.test(p) || p.startsWith("\\\\");
}

/**
 * Parses what a user typed as the target of a new policy: an absolute folder path
 * (for this user and computer), "user@host:/path", "user@host" or "@host".
 * Mirrors kopia's ParseSourceInfo and the old UI's checks.
 */
export function parsePolicyTarget(
  input: string,
  local: { userName: string; host: string },
): PolicyTarget | { error: string } {
  const s = input.trim();
  if (!s) return { error: "Enter a folder path, user@computer or @computer." };
  if (isAbsolutePath(s)) return { userName: local.userName, host: local.host, path: s };
  const at = s.indexOf("@");
  if (at < 0) return { error: "Relative paths can't have policies. Enter a full path like C:\\Data or /home/me." };
  const colon = s.indexOf(":", at);
  const userName = s.slice(0, at);
  const host = colon < 0 ? s.slice(at + 1) : s.slice(at + 1, colon);
  if (!host) return { error: "A computer name is required after “@”." };
  if (colon < 0) return { userName, host, path: "" };
  const path = s.slice(colon + 1);
  if (!userName) return { error: "A user name is required before “@” for a folder policy." };
  if (!isAbsolutePath(path)) return { error: "The folder after “:” must be a full path." };
  return { userName, host, path };
}

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/** Returns a copy of `obj` with `path` set. `undefined` removes the field and prunes empty parents. */
export function setPath(obj: Policy, path: string, value: unknown): Policy {
  const [key, ...rest] = path.split(".");
  const copy: Policy = { ...obj };
  if (rest.length === 0) {
    if (value === undefined) delete copy[key];
    else copy[key] = value;
    return copy;
  }
  const child = copy[key] && typeof copy[key] === "object" ? (copy[key] as Policy) : {};
  const next = setPath(child, rest.join("."), value);
  if (Object.keys(next).length === 0) delete copy[key];
  else copy[key] = next;
  return copy;
}

/** True if the value holds any setting (non-empty object, array or a scalar). */
export function hasContent(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v as object).some(hasContent);
  return true;
}

const SECTION_LABELS: Record<string, string> = {
  retention: "Retention",
  scheduling: "Schedule",
  files: "Files",
  errorHandling: "Errors",
  compression: "Compression",
  metadataCompression: "Metadata compression",
  splitter: "Splitter",
  upload: "Upload",
  actions: "Actions",
  logging: "Logging",
  osSnapshots: "OS snapshots",
};

/** Names of the sections a policy defines, e.g. ["Retention", "Schedule"]. */
export function definedSections(policy: Policy): string[] {
  const names = Object.entries(policy)
    .filter(([k, v]) => k !== "noParent" && hasContent(v))
    .map(([k]) => SECTION_LABELS[k] ?? k);
  if (policy.noParent) names.push("No inheritance");
  return names;
}

export interface TimeOfDay {
  hour: number;
  min: number;
}

export function parseTimeOfDay(s: string): TimeOfDay | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const min = Number(m[2]);
  return hour < 24 && min < 60 ? { hour, min } : null;
}

export const formatTimeOfDay = (t: TimeOfDay) => `${String(t.hour).padStart(2, "0")}:${String(t.min).padStart(2, "0")}`;

const ACTIONS = ["beforeSnapshotRoot", "afterSnapshotRoot", "beforeFolder", "afterFolder"];
const LISTS = [
  "files.ignore",
  "files.ignoreDotFiles",
  "compression.onlyCompress",
  "compression.neverCompress",
  "scheduling.cron",
];

/**
 * Prepares a policy for saving, as the old UI does: drops blank list entries and
 * actions without a script, and gives actions the default 5 minute timeout.
 */
export function cleanPolicy(policy: Policy): Policy {
  let p: Policy = JSON.parse(JSON.stringify(policy));
  for (const path of LISTS) {
    const list = getPath(p, path);
    if (Array.isArray(list)) {
      const cleaned = list.map((s) => String(s).trim()).filter(Boolean);
      p = setPath(p, path, cleaned.length ? cleaned : undefined);
    }
  }
  for (const a of ACTIONS) {
    const action = getPath(p, "actions." + a) as Record<string, unknown> | undefined;
    if (!action) continue;
    if (!action.script || !String(action.script).trim()) p = setPath(p, "actions." + a, undefined);
    else if (action.timeout === undefined) p = setPath(p, `actions.${a}.timeout`, 300);
  }
  return p;
}
