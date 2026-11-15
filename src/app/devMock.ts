// Dev-only fake Kopia server on top of apiClient (never bundled into builds:
// it is only imported behind import.meta.env.DEV). Response shapes follow the
// real API as exercised by tests/pages/*.test.jsx. Uploads progress on each
// poll and finish after a few seconds, so loading and polling are visible.
import MockAdapter from "axios-mock-adapter";
import { apiClient } from "../api";
import type { SourceInfo, SourceStatus } from "../api";
import type { DevMockMode } from "./devMockFlag";

const GB = 1e9;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();
const min = 60000;
const hour = 60 * min;
const day = 24 * hour;

function snapshot(startMsAgo: number, totalSize: number, files: number, numFailed = 0) {
  return {
    id: "m" + Math.round(startMsAgo),
    startTime: ago(startMsAgo),
    endTime: ago(startMsAgo - 5 * min),
    stats: { totalSize, fileCount: files, errorCount: numFailed },
    rootEntry: {
      obj: "k" + Math.round(startMsAgo).toString(16),
      summ: {
        size: totalSize,
        files,
        dirs: Math.round(files / 12),
        numFailed,
        errors: numFailed
          ? [{ path: "Projects/locked.db", error: "permission denied" }].slice(0, numFailed)
          : undefined,
      },
    },
  };
}

function initialSources(): SourceStatus[] {
  const me = { userName: "me", host: "workstation" };
  return [
    {
      source: { ...me, path: "C:\\Users\\me\\Documents" },
      status: "UPLOADING",
      upload: {
        hashedFiles: 9100,
        hashedBytes: 4.1 * GB,
        cachedFiles: 9100,
        cachedBytes: 3.3 * GB,
        estimatedBytes: 11.2 * GB,
        directory: "C:\\Users\\me\\Documents\\Invoices",
      },
      currentTask: "task-mock-1",
      lastSnapshot: snapshot(1 * day, 11.1 * GB, 26310),
      nextSnapshotTime: null,
    },
    {
      source: { ...me, path: "C:\\Users\\me\\Pictures" },
      status: "IDLE",
      lastSnapshot: snapshot(3 * hour, 186.4 * GB, 48211),
      nextSnapshotTime: inMs(21 * hour),
    },
    {
      source: { ...me, path: "D:\\Projects" },
      status: "IDLE",
      lastSnapshot: snapshot(50 * min, 23.9 * GB, 152004, 1),
      nextSnapshotTime: inMs(10 * min),
    },
    {
      source: { ...me, path: "C:\\Users\\me\\AppData\\Roaming\\Thunderbird" },
      status: "IDLE",
      lastSnapshot: snapshot(9 * day, 4.2 * GB, 1830),
      nextSnapshotTime: ago(2 * day),
    },
    { source: { ...me, path: "E:\\Videos" }, status: "PENDING", lastSnapshot: null, nextSnapshotTime: null },
    {
      source: { userName: "root", host: "nas", path: "/volume1/docker" },
      status: "IDLE",
      lastSnapshot: snapshot(6 * hour, 8.7 * GB, 9102),
      nextSnapshotTime: inMs(18 * hour),
    },
  ];
}

function parseSource(url: string | undefined): SourceInfo {
  const q = new URLSearchParams((url ?? "").split("?")[1] ?? "");
  return { userName: q.get("userName") ?? "", host: q.get("host") ?? "", path: q.get("path") ?? "" };
}

const same = (a: SourceInfo, b: SourceInfo) => a.userName === b.userName && a.host === b.host && a.path === b.path;

export async function installDevMock(mode: DevMockMode): Promise<void> {
  const mock = new MockAdapter(apiClient, { delayResponse: 250 });
  let sources = mode === "empty" ? [] : initialSources();

  // Advances running uploads; called on every /sources poll.
  const tick = () => {
    for (const s of sources) {
      if (s.status === "PENDING" && !sources.some((o) => o.status === "UPLOADING")) {
        s.status = "UPLOADING";
        s.upload = {
          hashedFiles: 0,
          hashedBytes: 0,
          cachedFiles: 0,
          cachedBytes: 0,
          estimatedBytes: 2.5 * GB,
          directory: s.source.path,
        };
        s.currentTask = "task-mock-" + Date.now();
        continue;
      }
      if (s.status !== "UPLOADING" || !s.upload) continue;
      const est = s.upload.estimatedBytes ?? 5 * GB;
      s.upload.hashedBytes = (s.upload.hashedBytes ?? 0) + est * 0.12;
      s.upload.hashedFiles = (s.upload.hashedFiles ?? 0) + 800;
      if ((s.upload.hashedBytes ?? 0) + (s.upload.cachedBytes ?? 0) >= est) {
        s.status = "IDLE";
        s.lastSnapshot = snapshot(0, est, (s.upload.hashedFiles ?? 0) + (s.upload.cachedFiles ?? 0));
        s.upload = null;
        s.currentTask = undefined;
        s.nextSnapshotTime = inMs(day);
      }
    }
  };

  // Repository: "disconnected" starts without a repository; the setup wizard can create/connect one.
  let connected = mode !== "disconnected";
  let repoDescription = "Dev mock repository";
  const existingRepoPaths = new Set(["D:\\Backups\\kopia", "/mnt/backup/kopia"]);
  const MOCK_PASSWORD = "mock"; // the dev mock accepts only this password for existing repositories

  mock.onGet("/repo/status").reply(() =>
    connected
      ? [
          200,
          {
            connected: true,
            description: repoDescription,
            configFile: "C:\\Users\\me\\AppData\\Roaming\\kopia\\repository.config",
            storage: "filesystem",
            hash: "BLAKE2B-256-128",
            encryption: "AES256-GCM-HMAC-SHA256",
            splitter: "DYNAMIC-4M-BUZHASH",
            formatVersion: 3,
            eccOverheadPercent: 0,
            hostname: "workstation",
            username: "me",
          },
        ]
      : [200, { connected: false, hostname: "", username: "" }],
  );
  mock.onGet("/repo/algorithms").reply(200, {
    defaultHash: "BLAKE2B-256-128",
    defaultEncryption: "AES256-GCM-HMAC-SHA256",
    defaultEcc: "REED-SOLOMON-CRC32",
    defaultSplitter: "DYNAMIC-4M-BUZHASH",
    hash: [{ id: "BLAKE2B-256-128" }, { id: "BLAKE3-256" }, { id: "HMAC-SHA256" }],
    encryption: [{ id: "AES256-GCM-HMAC-SHA256" }, { id: "CHACHA20-POLY1305-HMAC-SHA256" }],
    ecc: [{ id: "REED-SOLOMON-CRC32" }],
    splitter: [{ id: "DYNAMIC-4M-BUZHASH" }, { id: "DYNAMIC-1M-BUZHASH" }, { id: "FIXED-4M" }],
    compression: [{ id: "zstd" }, { id: "pgzip", deprecated: true }],
  });
  mock.onGet("/current-user").reply(200, { username: "me", hostname: "workstation" });
  // Folders that "exist" on the fake server (for the "folder will be created" hint).
  const existingFolders = new Set([
    "C:\\Users\\me",
    ...["Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"].map((f) => "C:\\Users\\me\\" + f),
    "C:\\Users\\me\\Desktop\\Projects",
    "D:\\Projects",
    "D:\\Backups",
  ]);
  mock.onPost("/repo/exists").reply((config) => {
    const path = JSON.parse(config.data).storage?.config?.path;
    if (existingRepoPaths.has(path)) return [200, {}];
    if (existingFolders.has(path)) return [400, { code: "NOT_INITIALIZED", error: "repository not initialized" }];
    return [
      500,
      {
        code: "INTERNAL",
        error: `internal server error: cannot access storage path: GetFileAttributesEx ${path}: The system cannot find the file specified.`,
      },
    ];
  });
  mock.onPost("/repo/create").reply((config) => {
    const req = JSON.parse(config.data);
    if (connected) return [400, { code: "ALREADY_CONNECTED", error: "already connected" }];
    existingRepoPaths.add(req.storage.config.path);
    connected = true;
    repoDescription = req.clientOptions?.description || "My Repository";
    sources = [];
    return [200, { connected: true }];
  });
  mock.onPost("/repo/connect").reply((config) => {
    const req = JSON.parse(config.data);
    if (req.password !== MOCK_PASSWORD)
      return [400, { code: "INVALID_PASSWORD", error: "invalid repository password" }];
    connected = true;
    repoDescription = req.clientOptions?.description || "My Repository";
    return [200, { connected: true }];
  });
  mock.onPost("/repo/disconnect").reply(() => {
    connected = false;
    return [200, {}];
  });
  mock.onPost("/repo/description").reply((config) => {
    repoDescription = JSON.parse(config.data).description;
    return [200, {}];
  });
  mock
    .onGet("/ui-preferences")
    .reply(200, { bytesStringBase2: false, defaultSnapshotViewAll: false, theme: "light", pageSize: 20 });
  mock
    .onGet("/tasks-summary")
    .reply(() => [200, { RUNNING: sources.filter((s) => s.status === "UPLOADING").length, SUCCESS: 12 }]);

  mock.onGet("/sources").reply(() => {
    if (!connected) return [400, { code: "NOT_CONNECTED", error: "not connected" }];
    tick();
    return [
      200,
      { localUsername: "me", localHost: "workstation", multiUser: true, sources: JSON.parse(JSON.stringify(sources)) },
    ];
  });

  mock.onPost(/^\/sources\/upload\?/).reply((config) => {
    const src = parseSource(config.url);
    const s = sources.find((x) => same(x.source, src));
    if (!s) return [404, { error: "source not found" }];
    if (s.status === "IDLE" || s.status === "PAUSED") {
      s.status = sources.some((o) => o.status === "UPLOADING") ? "PENDING" : "UPLOADING";
      if (s.status === "UPLOADING") {
        s.upload = {
          hashedFiles: 0,
          hashedBytes: 0,
          cachedFiles: 0,
          cachedBytes: 0,
          estimatedBytes: totalOf(s),
          directory: s.source.path,
        };
        s.currentTask = "task-mock-" + Date.now();
      }
    }
    return [200, {}];
  });

  mock.onPost(/^\/sources\/cancel\?/).reply((config) => {
    const src = parseSource(config.url);
    const s = sources.find((x) => same(x.source, src));
    if (s && (s.status === "UPLOADING" || s.status === "PENDING")) {
      s.status = "IDLE";
      s.upload = null;
      s.currentTask = undefined;
    }
    return [200, {}];
  });

  mock.onPost("/repo/sync").reply(() => {
    sources = sources.map((s) => ({ ...s }));
    return [200, {}];
  });

  // ---- new snapshot page ----
  // Like the real server on Windows: "~" and relative paths are resolved against the home folder.
  mock.onPost("/paths/resolve").reply((config) => {
    const raw = String(JSON.parse(config.data).path ?? "");
    let path =
      raw === "~"
        ? "C:\\Users\\me"
        : raw.startsWith("~/")
          ? "C:\\Users\\me\\" + raw.slice(2)
          : /^[A-Za-z]:|^[\\/]/.test(raw)
            ? raw
            : "C:\\Users\\me\\" + raw;
    path = path.replace(/\//g, "\\").replace(/\\+$/, "");
    if (/^[A-Za-z]:$/.test(path)) path += "\\";
    return [200, { source: { userName: "me", host: "workstation", path } }];
  });
  mock.onGet(/^\/policy\?/).reply(404, { code: "NOT_FOUND", error: "policy not found" });
  mock.onPost(/^\/policy\/resolve\?/).reply(200, {
    effective: {
      retention: { keepLatest: 10, keepHourly: 48, keepDaily: 7, keepWeekly: 4, keepMonthly: 24, keepAnnual: 3 },
      scheduling: { intervalSeconds: 86400, timeOfDay: [{ hour: 2, min: 0 }] },
      compression: { compressorName: "zstd" },
      files: { ignore: [".git", "node_modules"] },
    },
    definition: {},
    upcomingSnapshotTimes: [inMs(10 * hour), inMs(34 * hour), inMs(58 * hour)],
  });
  const tasks = new Map<string, { started: number; id: string }>();
  mock.onPost("/estimate").reply(() => {
    const id = "estimate-" + Date.now();
    tasks.set(id, { id, started: Date.now() });
    return [
      200,
      { id, kind: "Estimate", description: "Estimate", status: "RUNNING", startTime: new Date().toISOString() },
    ];
  });
  mock.onGet(/^\/tasks\/estimate-[^/]+$/).reply((config) => {
    const id = (config.url ?? "").split("/").pop() as string;
    const t = tasks.get(id);
    if (!t) return [404, { error: "no such task" }];
    const elapsed = Math.min(1, (Date.now() - t.started) / 3000);
    const done = elapsed >= 1;
    return [
      200,
      {
        id,
        kind: "Estimate",
        description: "Estimate",
        status: done ? "SUCCESS" : "RUNNING",
        startTime: new Date(t.started).toISOString(),
        endTime: done ? new Date(t.started + 3000).toISOString() : undefined,
        counters: {
          Bytes: { value: Math.round(4.2 * GB * elapsed) },
          "Excluded Bytes": { value: Math.round(0.3 * GB * elapsed) },
          Files: { value: Math.round(12840 * elapsed) },
          "Excluded Files": { value: Math.round(410 * elapsed) },
          Directories: { value: Math.round(1320 * elapsed) },
          "Excluded Directories": { value: 12 },
          Errors: { value: 0 },
          "Ignored Errors": { value: 0 },
        },
      },
    ];
  });
  mock.onPost(/^\/tasks\/estimate-[^/]+\/cancel$/).reply(200, {});
  mock.onPost("/sources").reply((config) => {
    const req = JSON.parse(config.data);
    if (!req.policy) return [400, { code: "MALFORMED_REQUEST", error: "missing policy" }];
    const source = { userName: "me", host: "workstation", path: req.path };
    if (!sources.some((s) => same(s.source, source))) {
      sources.push({
        source,
        status: req.createSnapshot ? "PENDING" : "IDLE",
        lastSnapshot: null,
        nextSnapshotTime: inMs(10 * hour),
      });
    }
    return [200, { snapshotStarted: !!req.createSnapshot }];
  });

  // ---- source detail: history, browsing, restore, mounts ----
  const key = (s: SourceInfo) => s.userName + "@" + s.host + ":" + s.path;
  const histories = new Map<string, ReturnType<typeof history>>();
  const historyOf = (src: SourceInfo) => {
    const s = sources.find((x) => same(x.source, src));
    if (!histories.has(key(src))) histories.set(key(src), s?.lastSnapshot ? history(s) : []);
    return histories.get(key(src)) ?? [];
  };
  mock.onGet(/^\/snapshots\?/).reply((config) => {
    const all = historyOf(parseSource(config.url));
    const showAll = /[?&]all=1/.test(config.url ?? "");
    const visible = showAll ? all : all.filter((s) => !s.identical);
    return [
      200,
      { snapshots: visible, unfilteredCount: all.length, uniqueCount: all.filter((s) => !s.identical).length },
    ];
  });
  mock.onPost("/snapshots/delete").reply((config) => {
    const req = JSON.parse(config.data);
    if (req.deleteSourceAndPolicy) {
      sources = sources.filter((s) => !same(s.source, req.source));
      histories.delete(key(req.source));
      return [200, {}];
    }
    const ids = new Set<string>(req.snapshotManifestIds ?? []);
    histories.set(
      key(req.source),
      historyOf(req.source).filter((s) => !ids.has(s.id)),
    );
    return [200, {}];
  });
  mock
    .onGet(/^\/objects\/[^/?]+$/)
    .reply((config) => [
      200,
      { entries: fakeDirectory(decodeURIComponent((config.url ?? "").split("/").pop() ?? "")) },
    ]);
  const mounted = new Map<string, string>();
  mock.onGet(/^\/mounts\/[^/]+$/).reply((config) => {
    const oid = decodeURIComponent((config.url ?? "").split("/").pop() ?? "");
    return mounted.has(oid)
      ? [200, { root: oid, path: mounted.get(oid) }]
      : [404, { code: "NOT_FOUND", error: "not mounted" }];
  });
  mock.onPost("/mounts").reply((config) => {
    const oid = JSON.parse(config.data).root;
    mounted.set(oid, "Z:\\");
    return [200, { root: oid, path: "Z:\\" }];
  });
  mock.onDelete(/^\/mounts\/[^/]+$/).reply((config) => {
    mounted.delete(decodeURIComponent((config.url ?? "").split("/").pop() ?? ""));
    return [200, {}];
  });
  mock
    .onPost("/restore")
    .reply(() => [
      200,
      {
        id: "restore-" + Date.now(),
        kind: "Restore",
        description: "Restore",
        status: "RUNNING",
        startTime: new Date().toISOString(),
      },
    ]);

  // Anything else: make missing mocks obvious instead of hitting the network.
  mock.onAny().reply((config) => {
    console.warn("[dev mock] unmocked request", config.method?.toUpperCase(), config.url);
    return [501, { error: "not mocked: " + config.url }];
  });

  console.info(`[dev mock] active (${mode}). Use ?mock=0 to talk to a real Kopia server.`);
}

/** A plausible snapshot history ending with the source's last snapshot. */
function history(s: SourceStatus) {
  const last = s.lastSnapshot;
  const lastAgo = last ? Date.now() - new Date(last.startTime).valueOf() : 0;
  const size = last?.stats?.totalSize ?? 3 * GB;
  const files = last?.stats?.fileCount ?? 1000;
  const offsets = [0, 1 * day, 2 * day, 3 * day, 7 * day, 14 * day, 21 * day, 35 * day, 70 * day];
  return offsets.map((off, i) => {
    const start = lastAgo + off;
    const retention = [
      ...(i < 3 ? [`latest-${i + 1}`] : []),
      ...(i < 4 ? [`daily-${i + 1}`] : []),
      ...([0, 4, 5, 6].includes(i) ? [`weekly-${[0, 4, 5, 6].indexOf(i) + 1}`] : []),
      ...([0, 7, 8].includes(i) ? [`monthly-${[0, 7, 8].indexOf(i) + 1}`] : []),
    ];
    return {
      id: `snap-${i}-${Math.round(start / 1000)}`,
      source: s.source,
      description: i === 5 ? "Before reorganizing folders" : "",
      startTime: new Date(Date.now() - start).toISOString(),
      endTime: new Date(Date.now() - start + 4 * min).toISOString(),
      rootID: `k${i}root`,
      retention,
      pins: i === 5 ? ["keep"] : [],
      identical: i === 2,
      summary: {
        size: Math.round(size * (1 - i * 0.03)),
        files: Math.round(files * (1 - i * 0.02)),
        dirs: Math.round(files / 12),
        numFailed: i === 0 ? (last?.rootEntry?.summ?.numFailed ?? 0) : 0,
        errors: i === 0 ? last?.rootEntry?.summ?.errors : undefined,
      },
    };
  });
}

/** Deterministic fake folder contents: object IDs ending in "root" or "d…" are folders. */
function fakeDirectory(oid: string) {
  const mtime = ago(3 * day);
  const dir = (name: string, size: number) => ({
    name,
    type: "d",
    mtime,
    obj: oid + "-d" + name.replace(/\W/g, ""),
    summ: { size, files: 40 },
  });
  const file = (name: string, size: number) => ({
    name,
    type: "f",
    mtime,
    size,
    obj: "f" + oid + name.replace(/\W/g, ""),
  });
  if (oid.split("-d").length > 3) return [file("readme.txt", 1200)];
  return [
    dir("Invoices", 1.2 * GB),
    dir("Taxes 2026", 340e6),
    dir("Contracts", 88e6),
    file("notes.md", 18e3),
    file("passport-scan.pdf", 2.4e6),
  ];
}

function totalOf(s: SourceStatus): number {
  return s.lastSnapshot?.stats?.totalSize || 3 * GB;
}
