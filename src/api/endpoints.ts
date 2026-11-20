// One function per Kopia REST endpoint. Every function accepts an optional
// { signal } so callers (and the polling hooks) can cancel in-flight requests.
import { API_BASE, del, get, post, put, RequestOptions, sourceQuery } from "./client";
import type {
  Algorithms,
  CliInfo,
  CreateSourceRequest,
  CurrentUser,
  DeleteSnapshotsRequest,
  DirectoryResponse,
  EditSnapshotsRequest,
  EstimateRequest,
  MountInfo,
  NotificationProfile,
  PoliciesResponse,
  PolicyTarget,
  RepoConnectRequest,
  RepoStatus,
  ResolvedPolicy,
  ResolvePathResponse,
  RestoreRequest,
  SnapshotsResponse,
  SourceInfo,
  SourcesResponse,
  Task,
  TaskLogsResponse,
  TasksResponse,
  TasksSummary,
  ThrottleLimits,
  UIPreferencesPayload,
} from "./types";

type Opts = RequestOptions;

// ---- repository ----

export const repo = {
  status: (o?: Opts) => get<RepoStatus>("/repo/status", o),
  algorithms: (o?: Opts) => get<Algorithms>("/repo/algorithms", o),
  exists: (req: RepoConnectRequest, o?: Opts) => post<unknown>("/repo/exists", req, o),
  create: (req: RepoConnectRequest, o?: Opts) => post<RepoStatus>("/repo/create", req, o),
  connect: (req: RepoConnectRequest, o?: Opts) => post<RepoStatus>("/repo/connect", req, o),
  disconnect: (o?: Opts) => post<unknown>("/repo/disconnect", {}, o),
  setDescription: (description: string, o?: Opts) => post<RepoStatus>("/repo/description", { description }, o),
  /** Re-reads manifests from the repository (e.g. after another client wrote snapshots). */
  sync: (o?: Opts) => post<unknown>("/repo/sync", {}, o),
  /** Network limits. Fails with STORAGE_CONNECTION for repositories reached through a Kopia server. */
  throttle: (o?: Opts) => get<ThrottleLimits>("/repo/throttle", o),
  /** Replaces all limits (omitted = unlimited). The server also saves them in the repository config. */
  setThrottle: (limits: ThrottleLimits, o?: Opts) => put<unknown>("/repo/throttle", limits, o),
};

export const currentUser = (o?: Opts) => get<CurrentUser>("/current-user", o);
export const cliInfo = (o?: Opts) => get<CliInfo>("/cli", o);

// ---- sources ----

export const sources = {
  list: (o?: Opts) => get<SourcesResponse>("/sources", o),
  create: (req: CreateSourceRequest, o?: Opts) => post<unknown>("/sources", req, o),
  /** Starts a snapshot of the source now. */
  upload: (src: SourceInfo, o?: Opts) => post<unknown>("/sources/upload?" + sourceQuery(src), {}, o),
  /** Cancels a running snapshot of the source. */
  cancel: (src: SourceInfo, o?: Opts) => post<unknown>("/sources/cancel?" + sourceQuery(src), {}, o),
  resolvePath: (path: string, o?: Opts) => post<ResolvePathResponse>("/paths/resolve", { path }, o),
  /** Starts an estimate task; poll it with tasks.get(id). */
  estimate: (req: EstimateRequest, o?: Opts) => post<Task>("/estimate", req, o),
};

// ---- snapshots ----

export const snapshots = {
  list: (src: SourceInfo, opts: { all?: boolean } = {}, o?: Opts) =>
    get<SnapshotsResponse>("/snapshots?" + sourceQuery(src) + (opts.all ? "&all=1" : ""), o),
  delete: (req: DeleteSnapshotsRequest, o?: Opts) => post<unknown>("/snapshots/delete", req, o),
  /** Deletes all snapshots of a source together with its policy. */
  deleteSource: (src: SourceInfo, o?: Opts) =>
    post<unknown>("/snapshots/delete", { source: src, deleteSourceAndPolicy: true }, o),
  edit: (req: EditSnapshotsRequest, o?: Opts) => post<unknown>("/snapshots/edit", req, o),
};

// ---- objects, restore, mounts ----

export const objects = {
  directory: (oid: string, o?: Opts) => get<DirectoryResponse>("/objects/" + encodeURIComponent(oid), o),
  /** URL for a plain <a href> download of a file object. */
  downloadUrl: (oid: string, fileName?: string) =>
    API_BASE + "/objects/" + encodeURIComponent(oid) + (fileName ? "?fname=" + encodeURIComponent(fileName) : ""),
};

/** Starts a restore task; poll it with tasks.get(id). */
export const restore = (req: RestoreRequest, o?: Opts) => post<Task>("/restore", req, o);

export const mounts = {
  get: (oid: string, o?: Opts) => get<MountInfo>("/mounts/" + encodeURIComponent(oid), o),
  mount: (oid: string, o?: Opts) => post<MountInfo>("/mounts", { root: oid }, o),
  unmount: (oid: string, o?: Opts) => del<unknown>("/mounts/" + encodeURIComponent(oid), o),
};

// ---- policies ----

export const policies = {
  list: (o?: Opts) => get<PoliciesResponse>("/policies", o),
  get: (target: PolicyTarget, o?: Opts) => get<Record<string, unknown>>("/policy?" + sourceQuery(target), o),
  save: (target: PolicyTarget, policy: Record<string, unknown>, o?: Opts) =>
    put<unknown>("/policy?" + sourceQuery(target), policy, o),
  delete: (target: PolicyTarget, o?: Opts) => del<unknown>("/policy?" + sourceQuery(target), o),
  /** Previews the effective policy if `updates` were applied, plus upcoming snapshot times. */
  resolve: (target: PolicyTarget, updates: Record<string, unknown>, numUpcomingSnapshotTimes = 5, o?: Opts) =>
    post<ResolvedPolicy>("/policy/resolve?" + sourceQuery(target), { updates, numUpcomingSnapshotTimes }, o),
};

// ---- tasks ----

export const tasks = {
  list: (o?: Opts) => get<TasksResponse>("/tasks", o),
  get: (id: string, o?: Opts) => get<Task>("/tasks/" + encodeURIComponent(id), o),
  logs: (id: string, o?: Opts) => get<TaskLogsResponse>("/tasks/" + encodeURIComponent(id) + "/logs", o),
  cancel: (id: string, o?: Opts) => post<unknown>("/tasks/" + encodeURIComponent(id) + "/cancel", {}, o),
  summary: (o?: Opts) => get<TasksSummary>("/tasks-summary", o),
};

// ---- notifications ----

export const notifications = {
  list: (o?: Opts) => get<NotificationProfile[]>("/notificationProfiles", o),
  /** Creates or replaces the profile with the same name (the server uses POST for both). */
  save: (profile: NotificationProfile, o?: Opts) => post<unknown>("/notificationProfiles", profile, o),
  delete: (name: string, o?: Opts) => del<unknown>("/notificationProfiles/" + encodeURIComponent(name), o),
  test: (profile: NotificationProfile, o?: Opts) => post<unknown>("/testNotificationProfile", profile, o),
};

// ---- UI preferences ----

export const uiPreferences = {
  get: (o?: Opts) => get<UIPreferencesPayload>("/ui-preferences", o),
  save: (prefs: UIPreferencesPayload, o?: Opts) => put<unknown>("/ui-preferences", prefs, o),
};
