import { DependencyList, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, isCanceled, toApiError } from "./client";

/** Milliseconds until the next fetch, or null to stop polling. */
export type PollInterval<T> = number | null | ((data: T | undefined) => number | null);

export interface PollingOptions<T> {
  /** Poll interval, or a function of the last data (return null to stop). Omit/null = fetch once. */
  interval?: PollInterval<T>;
  /** When false, nothing is fetched and the last result is kept. Default true. */
  enabled?: boolean;
  /** Skip scheduled fetches while the browser tab is hidden; refetch when it becomes visible. Default true. */
  pauseWhenHidden?: boolean;
}

export interface PollingResult<T> {
  data: T | undefined;
  error: ApiError | undefined;
  /** True until the first response (success or error) for the current deps. */
  isLoading: boolean;
  /** Fetches immediately (outside the schedule) and resolves when done. */
  refresh: () => Promise<void>;
}

function sameDeps(a: DependencyList, b: DependencyList): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

function resolveInterval<T>(interval: PollInterval<T> | undefined, data: T | undefined): number | null {
  if (typeof interval === "function") return interval(data);
  return interval ?? null;
}

/**
 * Fetches data and optionally keeps polling it.
 *
 * - Requests never overlap: the next one is scheduled after the previous finished.
 * - Changing `deps` cancels the in-flight request, clears data and starts over.
 * - Responses that arrive after unmount or a deps change are discarded.
 * - Errors keep the last good data, so a flaky poll doesn't blank the UI.
 */
export function usePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  options: PollingOptions<T> = {},
): PollingResult<T> {
  const { interval, enabled = true, pauseWhenHidden = true } = options;

  // `generation` changes whenever deps/enabled change; the fetch effect keys off it.
  // Resetting during render (instead of in the effect) avoids a stale-data render.
  const currentDeps = [enabled, ...deps];
  const [state, setState] = useState<{ deps: DependencyList; generation: number; data?: T; error?: ApiError; isLoading: boolean }>(
    () => ({ deps: currentDeps, generation: 0, isLoading: enabled }),
  );
  if (!sameDeps(state.deps, currentDeps)) {
    setState({ deps: currentDeps, generation: state.generation + 1, isLoading: enabled });
  }
  const generation = state.generation;

  // Latest values, read from timers without restarting the effect.
  const fetcherRef = useRef(fetcher);
  const intervalRef = useRef(interval);
  const pauseRef = useRef(pauseWhenHidden);
  useEffect(() => {
    fetcherRef.current = fetcher;
    intervalRef.current = interval;
    pauseRef.current = pauseWhenHidden;
  });

  // Set by the effect for the current deps generation.
  const runRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!enabled) {
      runRef.current = null;
      return;
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let inFlight: Promise<void> | null = null;
    let lastData: T | undefined;
    let pendingWhileHidden = false;

    const schedule = () => {
      if (disposed) return;
      const ms = resolveInterval(intervalRef.current, lastData);
      if (ms === null || ms === undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (pauseRef.current && typeof document !== "undefined" && document.hidden) {
          pendingWhileHidden = true;
          return;
        }
        void run();
      }, ms);
    };

    const run = (): Promise<void> => {
      if (disposed) return Promise.resolve();
      if (inFlight) return inFlight;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      controller = new AbortController();
      const signal = controller.signal;
      inFlight = fetcherRef
        .current(signal)
        .then(
          (data) => {
            if (disposed || signal.aborted) return;
            lastData = data;
            setState((s) => ({ ...s, data, error: undefined, isLoading: false }));
          },
          (err: unknown) => {
            if (disposed || signal.aborted || isCanceled(err)) return;
            setState((s) => ({ ...s, error: toApiError(err), isLoading: false }));
          },
        )
        .finally(() => {
          inFlight = null;
          schedule();
        });
      return inFlight;
    };

    const onVisibility = () => {
      if (!document.hidden && pendingWhileHidden) {
        pendingWhileHidden = false;
        void run();
      }
    };

    runRef.current = run;
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
    void run();

    return () => {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      controller?.abort();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      if (runRef.current === run) runRef.current = null;
    };
  }, [enabled, generation]);

  const refresh = useCallback(() => (runRef.current ? runRef.current() : Promise.resolve()), []);

  return { data: state.data, error: state.error, isLoading: state.isLoading, refresh };
}

/** Fetches once per deps change (no polling). */
export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  options: Omit<PollingOptions<T>, "interval"> = {},
): PollingResult<T> {
  return usePolling(fetcher, deps, { ...options, interval: null });
}
