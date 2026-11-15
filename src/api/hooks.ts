// Data hooks for the new UI. Poll intervals match the old UI:
// tasks-summary 5 s; sources, tasks, logs 3 s; a single task 0.5 s until it ends.
import { useCallback } from "react";
import * as api from "./endpoints";
import { PollingOptions, PollingResult, useApi, usePolling } from "./usePolling";
import type {
  DirectoryResponse,
  MountInfo,
  PoliciesResponse,
  PolicyTarget,
  RepoStatus,
  SnapshotsResponse,
  SourceInfo,
  SourcesResponse,
  Task,
  TaskLogsResponse,
  TasksResponse,
  TasksSummary,
} from "./types";

export const POLL = {
  tasksSummary: 5000,
  sources: 3000,
  tasks: 3000,
  taskLogs: 3000,
  task: 500,
} as const;

type HookOptions<T> = Pick<PollingOptions<T>, "enabled" | "pauseWhenHidden">;

const isFinished = (t: Task | undefined) => !!t?.endTime;

/** Repository status. Fetched once; pass `interval` to poll (e.g. while initTaskID is set). */
export function useRepoStatus(options: PollingOptions<RepoStatus> = {}): PollingResult<RepoStatus> {
  return usePolling((signal) => api.repo.status({ signal }), [], options);
}

/** All snapshot sources with their upload status, polled every 3 s. */
export function useSources(options: HookOptions<SourcesResponse> = {}): PollingResult<SourcesResponse> {
  return usePolling((signal) => api.sources.list({ signal }), [], { ...options, interval: POLL.sources });
}

/** Snapshot history of one source. `all` includes snapshots hidden by retention/identical content. */
export function useSnapshots(
  source: SourceInfo | null | undefined,
  opts: { all?: boolean } & HookOptions<SnapshotsResponse> = {},
): PollingResult<SnapshotsResponse> {
  const { all = false, enabled = true, ...rest } = opts;
  return useApi((signal) => api.snapshots.list(source as SourceInfo, { all }, { signal }), [source?.userName, source?.host, source?.path, all], {
    ...rest,
    enabled: enabled && !!source,
  });
}

/** Contents of a snapshot directory object. */
export function useDirectory(oid: string | null | undefined, options: HookOptions<DirectoryResponse> = {}): PollingResult<DirectoryResponse> {
  const { enabled = true, ...rest } = options;
  return useApi((signal) => api.objects.directory(oid as string, { signal }), [oid], { ...rest, enabled: enabled && !!oid });
}

/** Mount state of a snapshot directory. */
export function useMount(oid: string | null | undefined, options: HookOptions<MountInfo> = {}): PollingResult<MountInfo> {
  const { enabled = true, ...rest } = options;
  return useApi((signal) => api.mounts.get(oid as string, { signal }), [oid], { ...rest, enabled: enabled && !!oid });
}

export function usePolicies(options: HookOptions<PoliciesResponse> = {}): PollingResult<PoliciesResponse> {
  return useApi((signal) => api.policies.list({ signal }), [], options);
}

export function usePolicy(target: PolicyTarget | null | undefined, options: HookOptions<Record<string, unknown>> = {}) {
  const { enabled = true, ...rest } = options;
  return useApi((signal) => api.policies.get(target as PolicyTarget, { signal }), [target?.userName, target?.host, target?.path], {
    ...rest,
    enabled: enabled && !!target,
  });
}

/** All tasks, polled every 3 s. */
export function useTasks(options: HookOptions<TasksResponse> = {}): PollingResult<TasksResponse> {
  return usePolling((signal) => api.tasks.list({ signal }), [], { ...options, interval: POLL.tasks });
}

/** A single task, polled every 0.5 s until it has an endTime. */
export function useTask(id: string | null | undefined, options: HookOptions<Task> = {}): PollingResult<Task> {
  const { enabled = true, ...rest } = options;
  return usePolling((signal) => api.tasks.get(id as string, { signal }), [id], {
    ...rest,
    enabled: enabled && !!id,
    interval: (t) => (isFinished(t) ? null : POLL.task),
  });
}

/**
 * Log of a task, polled every 3 s while `follow` is true (default).
 * Pass follow = !task.endTime to stop once the task has finished.
 */
export function useTaskLogs(
  id: string | null | undefined,
  opts: { follow?: boolean } & HookOptions<TaskLogsResponse> = {},
): PollingResult<TaskLogsResponse> {
  const { follow = true, enabled = true, ...rest } = opts;
  return usePolling((signal) => api.tasks.logs(id as string, { signal }), [id, follow], {
    ...rest,
    enabled: enabled && !!id,
    interval: follow ? POLL.taskLogs : null,
  });
}

/** Task counts per status for the navigation badge, polled every 5 s. */
export function useTasksSummary(options: HookOptions<TasksSummary> = {}): PollingResult<TasksSummary> & { runningCount: number } {
  const result = usePolling((signal) => api.tasks.summary({ signal }), [], { ...options, interval: POLL.tasksSummary });
  return { ...result, runningCount: result.data?.RUNNING ?? 0 };
}

/**
 * Wraps a mutation (e.g. api.sources.upload) and refreshes the given queries afterwards,
 * so lists reflect the change without waiting for the next poll.
 */
export function useRefreshAfter<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
  ...toRefresh: Array<Pick<PollingResult<unknown>, "refresh">>
): (...args: A) => Promise<R> {
  return useCallback(
    async (...args: A) => {
      const result = await action(...args);
      await Promise.all(toRefresh.map((q) => q.refresh()));
      return result;
    },
    // refresh functions are stable; action identity is the caller's concern.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [action, ...toRefresh.map((q) => q.refresh)],
  );
}
