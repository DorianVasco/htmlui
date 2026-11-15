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
        errors: numFailed ? [{ path: "Projects/locked.db", error: "permission denied" }].slice(0, numFailed) : undefined,
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
      upload: { hashedFiles: 9100, hashedBytes: 4.1 * GB, cachedFiles: 9100, cachedBytes: 3.3 * GB, estimatedBytes: 11.2 * GB, directory: "C:\\Users\\me\\Documents\\Invoices" },
      currentTask: "task-mock-1",
      lastSnapshot: snapshot(1 * day, 11.1 * GB, 26310),
      nextSnapshotTime: null,
    },
    { source: { ...me, path: "C:\\Users\\me\\Pictures" }, status: "IDLE", lastSnapshot: snapshot(3 * hour, 186.4 * GB, 48211), nextSnapshotTime: inMs(21 * hour) },
    { source: { ...me, path: "D:\\Projects" }, status: "IDLE", lastSnapshot: snapshot(50 * min, 23.9 * GB, 152004, 1), nextSnapshotTime: inMs(10 * min) },
    { source: { ...me, path: "C:\\Users\\me\\AppData\\Roaming\\Thunderbird" }, status: "IDLE", lastSnapshot: snapshot(9 * day, 4.2 * GB, 1830), nextSnapshotTime: ago(2 * day) },
    { source: { ...me, path: "E:\\Videos" }, status: "PENDING", lastSnapshot: null, nextSnapshotTime: null },
    { source: { userName: "root", host: "nas", path: "/volume1/docker" }, status: "IDLE", lastSnapshot: snapshot(6 * hour, 8.7 * GB, 9102), nextSnapshotTime: inMs(18 * hour) },
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
        s.upload = { hashedFiles: 0, hashedBytes: 0, cachedFiles: 0, cachedBytes: 0, estimatedBytes: 2.5 * GB, directory: s.source.path };
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
  mock.onPost("/repo/exists").reply((config) => {
    const path = JSON.parse(config.data).storage?.config?.path;
    return existingRepoPaths.has(path) ? [200, {}] : [400, { code: "NOT_INITIALIZED", error: "repository not initialized" }];
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
    if (req.password !== MOCK_PASSWORD) return [400, { code: "INVALID_PASSWORD", error: "invalid repository password" }];
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
  mock.onGet("/ui-preferences").reply(200, { bytesStringBase2: false, defaultSnapshotViewAll: false, theme: "light", pageSize: 20 });
  mock.onGet("/tasks-summary").reply(() => [200, { RUNNING: sources.filter((s) => s.status === "UPLOADING").length, SUCCESS: 12 }]);

  mock.onGet("/sources").reply(() => {
    if (!connected) return [400, { code: "NOT_CONNECTED", error: "not connected" }];
    tick();
    return [200, { localUsername: "me", localHost: "workstation", multiUser: true, sources: JSON.parse(JSON.stringify(sources)) }];
  });

  mock.onPost(/^\/sources\/upload\?/).reply((config) => {
    const src = parseSource(config.url);
    const s = sources.find((x) => same(x.source, src));
    if (!s) return [404, { error: "source not found" }];
    if (s.status === "IDLE" || s.status === "PAUSED") {
      s.status = sources.some((o) => o.status === "UPLOADING") ? "PENDING" : "UPLOADING";
      if (s.status === "UPLOADING") {
        s.upload = { hashedFiles: 0, hashedBytes: 0, cachedFiles: 0, cachedBytes: 0, estimatedBytes: totalOf(s), directory: s.source.path };
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

  // Anything else: make missing mocks obvious instead of hitting the network.
  mock.onAny().reply((config) => {
    console.warn("[dev mock] unmocked request", config.method?.toUpperCase(), config.url);
    return [501, { error: "not mocked: " + config.url }];
  });

  console.info(`[dev mock] active (${mode}). Use ?mock=0 to talk to a real Kopia server.`);
}

function totalOf(s: SourceStatus): number {
  return s.lastSnapshot?.stats?.totalSize || 3 * GB;
}
