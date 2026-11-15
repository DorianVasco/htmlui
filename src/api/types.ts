// Response/request shapes of the Kopia REST API, as far as the UI uses them.
// Fields are optional where the server may omit them. Unknown extra fields
// are allowed so the types don't block access to data not modeled here.

export interface SourceInfo {
  userName: string;
  host: string;
  path: string;
}

/** Policy target: global = all empty, host = host only, user = userName+host, directory = all set. */
export type PolicyTarget = Partial<SourceInfo>;

// ---- repository ----

export interface RepoStatus {
  connected: boolean;
  description?: string;
  configFile?: string;
  storage?: string;
  hash?: string;
  encryption?: string;
  ecc?: string;
  eccOverheadPercent?: number;
  splitter?: string;
  formatVersion?: string | number;
  username?: string;
  hostname?: string;
  readonly?: boolean;
  supportsContentCompression?: boolean;
  /** Set while the server is still opening the repository. */
  initTaskID?: string;
  apiServerURL?: string;
  [key: string]: unknown;
}

export interface AlgorithmOption {
  id: string;
  deprecated?: boolean;
}

export interface Algorithms {
  defaultHash: string;
  defaultEncryption: string;
  defaultEcc: string;
  defaultSplitter: string;
  hash: AlgorithmOption[];
  encryption: AlgorithmOption[];
  ecc: AlgorithmOption[];
  splitter: AlgorithmOption[];
  compression: AlgorithmOption[];
}

export interface CurrentUser {
  username: string;
  hostname: string;
}

export interface CliInfo {
  executable: string;
  [key: string]: unknown;
}

/** Body of repo/create, repo/connect and repo/exists. Provider-specific; see SetupRepository. */
export interface RepoConnectRequest {
  storage?: { type: string; config: Record<string, unknown> };
  password?: string;
  token?: string;
  apiServer?: Record<string, unknown>;
  options?: Record<string, unknown>;
  clientOptions?: Record<string, unknown>;
  [key: string]: unknown;
}

// ---- sources & snapshots ----

export interface DirectorySummary {
  size?: number;
  files?: number;
  dirs?: number;
  maxTime?: string;
  numFailed?: number;
  errors?: { path: string; error: string }[];
  [key: string]: unknown;
}

export interface SnapshotSummary {
  id?: string;
  startTime: string;
  endTime?: string;
  stats?: { totalSize?: number; fileCount?: number; errorCount?: number; [key: string]: unknown };
  rootEntry?: { obj?: string; summ?: DirectorySummary; [key: string]: unknown };
  [key: string]: unknown;
}

export interface UploadCounters {
  hashedBytes?: number;
  hashedFiles?: number;
  cachedBytes?: number;
  cachedFiles?: number;
  estimatedBytes?: number;
  estimatedFiles?: number;
  directory?: string;
  [key: string]: unknown;
}

export type SourceStatusKind = "IDLE" | "PENDING" | "UPLOADING" | "PAUSED" | "FAILED" | "REMOTE" | string;

export interface SourceStatus {
  source: SourceInfo;
  status: SourceStatusKind;
  schedule?: Record<string, unknown>;
  lastSnapshot?: SnapshotSummary;
  nextSnapshotTime?: string;
  upload?: UploadCounters;
  currentTask?: string;
  [key: string]: unknown;
}

export interface SourcesResponse {
  localUsername: string;
  localHost: string;
  multiUser: boolean;
  sources: SourceStatus[];
}

export interface Snapshot {
  id: string;
  source?: SourceInfo;
  description?: string;
  startTime: string;
  endTime?: string;
  incomplete?: string;
  summary?: DirectorySummary;
  rootID: string;
  retention?: string[];
  pins?: string[];
  [key: string]: unknown;
}

export interface SnapshotsResponse {
  snapshots: Snapshot[];
  unfilteredCount: number;
  uniqueCount: number;
}

export interface CreateSourceRequest {
  path: string;
  createSnapshot?: boolean;
  policy?: Record<string, unknown>;
}

export interface ResolvePathResponse {
  source: SourceInfo;
}

export interface EstimateRequest {
  root: string;
  maxExamplesPerBucket?: number;
  policyOverride?: Record<string, unknown>;
}

export interface DeleteSnapshotsRequest {
  source: SourceInfo;
  snapshotManifestIds?: string[];
  deleteSourceAndPolicy?: boolean;
}

export interface EditSnapshotsRequest {
  snapshots: string[];
  description?: string;
  addPins?: string[];
  removePins?: string[];
}

// ---- objects, restore, mounts ----

export interface DirEntry {
  name: string;
  type: string;
  mode?: string;
  mtime?: string;
  size?: number;
  obj: string;
  summ?: DirectorySummary;
  [key: string]: unknown;
}

export interface DirectoryResponse {
  stream?: string;
  entries: DirEntry[];
  summary?: DirectorySummary;
}

export interface FilesystemRestoreOutput {
  targetPath: string;
  skipOwners?: boolean;
  skipPermissions?: boolean;
  skipTimes?: boolean;
  ignorePermissionErrors?: boolean;
  overwriteFiles?: boolean;
  overwriteDirectories?: boolean;
  overwriteSymlinks?: boolean;
  writeFilesAtomically?: boolean;
  writeSparseFiles?: boolean;
}

export interface RestoreRequest {
  root: string;
  options?: { incremental?: boolean; ignoreErrors?: boolean; restoreDirEntryAtDepth?: number; minSizeForPlaceholder?: number };
  fsOutput?: FilesystemRestoreOutput;
  zipFile?: string;
  uncompressedZip?: boolean;
  tarFile?: string;
  [key: string]: unknown;
}

export interface MountInfo {
  root?: string;
  path?: string;
  [key: string]: unknown;
}

// ---- policies ----

export interface PolicyListEntry {
  id?: string;
  target: SourceInfo;
  policy: Record<string, unknown>;
}

export interface PoliciesResponse {
  policies: PolicyListEntry[];
}

export interface ResolvedPolicy {
  effective: Record<string, unknown>;
  definition: Record<string, unknown>;
  defined?: Record<string, unknown>;
  upcomingSnapshotTimes?: string[];
  schedulingError?: string;
  [key: string]: unknown;
}

// ---- tasks ----

export type TaskStatusKind = "RUNNING" | "SUCCESS" | "FAILED" | "CANCELING" | "CANCELED" | string;

export interface Task {
  id: string;
  kind: string;
  description: string;
  status: TaskStatusKind;
  startTime: string;
  endTime?: string;
  progressInfo?: string;
  errorMessage?: string;
  counters?: Record<string, { value: number; units?: string; level?: string }>;
  [key: string]: unknown;
}

export interface TasksResponse {
  tasks: Task[];
}

export interface LogEntry {
  ts: number;
  level: number;
  mod?: string;
  msg: string;
  [key: string]: unknown;
}

export interface TaskLogsResponse {
  logs: LogEntry[];
}

/** Count of tasks per status, e.g. { RUNNING: 1, SUCCESS: 12 }. */
export type TasksSummary = Partial<Record<TaskStatusKind, number>>;

// ---- notifications ----

export interface NotificationProfile {
  profile: string;
  method: { type: string; config: Record<string, unknown> };
  minSeverity?: number;
  [key: string]: unknown;
}

// ---- UI preferences ----

export interface UIPreferencesPayload {
  pageSize?: number;
  bytesStringBase2?: boolean;
  defaultSnapshotViewAll?: boolean;
  theme?: string;
  fontSize?: string;
  preferWebDav?: boolean;
  [key: string]: unknown;
}
