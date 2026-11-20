// Repositories this browser has connected to, for quick switching.
//
// Stored in localStorage (per browser/KopiaUI window, not on the server).
// Passwords are never stored. Only storage types whose config holds no
// secrets are remembered (currently the local filesystem: just a path).
import { useSyncExternalStore } from "react";
import type { RepoStatus } from "../api";

export interface KnownRepo {
  /** Stable id: storage type + location. */
  id: string;
  storage: { type: string; config: { path: string } };
  description: string;
  clientOptions: { username: string; hostname: string; readonly: boolean };
  lastConnected: string;
}

const LIST_KEY = "kopia-known-repositories";
const ACTIVE_KEY = "kopia-active-repository";

export function repoId(type: string, path: string): string {
  return type + ":" + path;
}

/** Returns a rememberable storage spec, or null if the storage config may contain secrets. */
export function rememberableStorage(storage: {
  type: string;
  config: Record<string, unknown>;
}): KnownRepo["storage"] | null {
  if (storage.type === "filesystem" && typeof storage.config.path === "string" && storage.config.path) {
    return { type: "filesystem", config: { path: storage.config.path } };
  }
  return null;
}

// ---- store with change notification (also across tabs via the storage event) ----

const listeners = new Set<() => void>();
let cache: { list: KnownRepo[]; active: string | null } | null = null;

function read(): { list: KnownRepo[]; active: string | null } {
  if (cache) return cache;
  let list: KnownRepo[] = [];
  let active: string | null = null;
  try {
    const raw = localStorage.getItem(LIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    list = Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.id === "string" && r.storage?.config?.path) : [];
    active = localStorage.getItem(ACTIVE_KEY);
  } catch {
    // storage unavailable or corrupt: behave as empty
  }
  cache = { list, active };
  return cache;
}

function write(list: KnownRepo[], active: string | null) {
  cache = { list, active };
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
    if (active) localStorage.setItem(ACTIVE_KEY, active);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // keep the in-memory state even if persisting fails
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LIST_KEY || e.key === ACTIVE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useKnownRepos() {
  const state = useSyncExternalStore(subscribe, read, read);
  const sorted = [...state.list].sort((a, b) => b.lastConnected.localeCompare(a.lastConnected));
  return { repos: sorted, activeId: state.active };
}

/** The known repository the server is connected to right now, if any. */
export function useCurrentKnownRepo(status: RepoStatus | undefined): KnownRepo | undefined {
  const { repos, activeId } = useKnownRepos();
  if (!status?.connected || !activeId) return undefined;
  const entry = repos.find((r) => r.id === activeId);
  // Guard against a stale marker when the server was connected elsewhere (e.g. the classic UI).
  return entry && (!status.storage || status.storage === entry.storage.type) ? entry : undefined;
}

/** Adds or updates an entry and marks it as the active repository. */
export function rememberRepo(entry: Omit<KnownRepo, "id" | "lastConnected">): KnownRepo {
  const id = repoId(entry.storage.type, entry.storage.config.path);
  const full: KnownRepo = { ...entry, id, lastConnected: new Date().toISOString() };
  const { list } = read();
  write([full, ...list.filter((r) => r.id !== id)], id);
  return full;
}

export function updateRepo(id: string, patch: Partial<Pick<KnownRepo, "description">>) {
  const { list, active } = read();
  write(
    list.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    active,
  );
}

export function forgetRepo(id: string) {
  const { list, active } = read();
  write(
    list.filter((r) => r.id !== id),
    active === id ? null : active,
  );
}

export function setActiveRepo(id: string | null) {
  write(read().list, id);
}

/** For tests: drop the in-memory cache so the next read hits localStorage. */
export function resetKnownReposCache() {
  cache = null;
}
