// Mock data shaped after the Kopia REST API responses (/api/v1/...).
const now = Date.now();
const min = 60 * 1000;
const hour = 60 * min;
const day = 24 * hour;
const iso = (offset) => new Date(now + offset).toISOString();
const GB = 1000 ** 3;

export const repoStatus = {
  connected: true,
  description: "Home NAS Backup",
  configFile: "C:\\Users\\me\\AppData\\Roaming\\kopia\\repository.config",
  storage: "s3",
  storageDetails: "s3://backups-eu-central/kopia",
  hash: "BLAKE2B-256-128",
  encryption: "AES256-GCM-HMAC-SHA256",
  splitter: "DYNAMIC-4M-BUZHASH",
  formatVersion: 3,
  eccOverheadPercent: 0,
  username: "me",
  hostname: "workstation",
  readonly: false,
  totalSize: 412.6 * GB,
};

export const sources = [
  {
    source: { userName: "me", host: "workstation", path: "C:\\Users\\me\\Documents" },
    status: "UPLOADING",
    upload: { hashedBytes: 7.4 * GB, estimatedBytes: 11.2 * GB, hashedFiles: 18200, estimatedFiles: 26400 },
    lastSnapshot: { startTime: iso(-1 * day), endTime: iso(-1 * day + 6 * min), totalSize: 11.1 * GB, files: 26310, dirs: 3104, errors: 0 },
    nextSnapshotTime: null,
  },
  {
    source: { userName: "me", host: "workstation", path: "C:\\Users\\me\\Pictures" },
    status: "IDLE",
    lastSnapshot: { startTime: iso(-3 * hour), endTime: iso(-3 * hour + 14 * min), totalSize: 186.4 * GB, files: 48211, dirs: 902, errors: 0 },
    nextSnapshotTime: iso(21 * hour),
  },
  {
    source: { userName: "me", host: "workstation", path: "D:\\Projects" },
    status: "IDLE",
    lastSnapshot: { startTime: iso(-50 * min), endTime: iso(-47 * min), totalSize: 23.9 * GB, files: 152004, dirs: 20110, errors: 3 },
    nextSnapshotTime: iso(10 * min),
  },
  {
    source: { userName: "me", host: "workstation", path: "C:\\Users\\me\\AppData\\Roaming\\Thunderbird" },
    status: "IDLE",
    lastSnapshot: { startTime: iso(-9 * day), endTime: iso(-9 * day + 2 * min), totalSize: 4.2 * GB, files: 1830, dirs: 210, errors: 0 },
    nextSnapshotTime: null,
  },
  {
    source: { userName: "root", host: "nas", path: "/volume1/docker" },
    status: "IDLE",
    lastSnapshot: { startTime: iso(-6 * hour), endTime: iso(-6 * hour + 4 * min), totalSize: 8.7 * GB, files: 9102, dirs: 1203, errors: 0 },
    nextSnapshotTime: iso(18 * hour),
  },
  {
    source: { userName: "me", host: "workstation", path: "E:\\Videos" },
    status: "IDLE",
    lastSnapshot: null,
    nextSnapshotTime: null,
  },
];

// Snapshot history for a single source (retention labels as in /api/v1/snapshots).
export function snapshotsFor(src) {
  if (!src.lastSnapshot) return [];
  const base = new Date(src.lastSnapshot.startTime).valueOf();
  const retention = [
    ["latest-1", "hourly-1", "daily-1"],
    ["latest-2", "daily-2"],
    ["latest-3", "daily-3"],
    ["daily-4", "weekly-1"],
    ["weekly-2"],
    ["weekly-3", "monthly-1"],
    ["monthly-2"],
    ["monthly-3", "annual-1"],
  ];
  return retention.map((r, i) => ({
    id: "k" + (9183 + i * 37).toString(16) + "e1c0ffee" + i,
    startTime: new Date(base - (i < 4 ? i * day : (i - 2) * 7 * day)).toISOString(),
    description: i === 0 ? "" : i === 5 ? "Before Windows upgrade" : "",
    pins: i === 5 ? ["keep-forever"] : [],
    retention: r,
    totalSize: src.lastSnapshot.totalSize * (1 - i * 0.012),
    files: Math.round(src.lastSnapshot.files * (1 - i * 0.01)),
    errors: i === 2 ? 1 : 0,
    incomplete: false,
  }));
}

export const tasks = [
  { id: "t-112", kind: "Snapshot", description: "Snapshotting me@workstation:C:\\Users\\me\\Documents", status: "RUNNING", startTime: iso(-4 * min), progress: 66 },
  { id: "t-111", kind: "Maintenance", description: "Quick maintenance", status: "SUCCESS", startTime: iso(-47 * min), endTime: iso(-46 * min) },
  { id: "t-110", kind: "Snapshot", description: "Snapshotting me@workstation:D:\\Projects", status: "FAILED", startTime: iso(-50 * min), endTime: iso(-47 * min), error: "3 files could not be read (permission denied)" },
  { id: "t-109", kind: "Restore", description: "Restoring k3a8f… to C:\\Restore\\Pictures", status: "CANCELED", startTime: iso(-2 * hour), endTime: iso(-2 * hour + 3 * min) },
  { id: "t-108", kind: "Snapshot", description: "Snapshotting me@workstation:C:\\Users\\me\\Pictures", status: "SUCCESS", startTime: iso(-3 * hour), endTime: iso(-3 * hour + 14 * min) },
  { id: "t-107", kind: "Snapshot", description: "Snapshotting root@nas:/volume1/docker", status: "SUCCESS", startTime: iso(-6 * hour), endTime: iso(-6 * hour + 4 * min) },
];

export const policies = [
  { target: { userName: "", host: "", path: "" }, summary: "Keep 48 hourly, 7 daily, 4 weekly, 24 monthly, 3 annual · zstd" },
  { target: { userName: "", host: "nas", path: "" }, summary: "Snapshot every 24h at 03:00" },
  { target: { userName: "me", host: "workstation", path: "" }, summary: "Ignore .git, node_modules, *.tmp" },
  { target: { userName: "me", host: "workstation", path: "C:\\Users\\me\\Pictures" }, summary: "Snapshot daily at 02:00 · no compression" },
  { target: { userName: "me", host: "workstation", path: "D:\\Projects" }, summary: "Snapshot every 1h · before-snapshot action" },
];
