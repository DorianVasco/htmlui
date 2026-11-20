import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { usePolling } from "../../src/api/usePolling";
import { apiClient } from "../../src/api/client";
import { POLL, useTask, useTaskLogs, useTasksSummary } from "../../src/api/hooks";

const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePolling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  test("fetches immediately and then on every interval", async () => {
    let n = 0;
    const fetcher = vi.fn(async () => ++n);
    const { result } = renderHook(() => usePolling(fetcher, [], { interval: 1000 }));

    expect(result.current.isLoading).toBe(true);
    await flush();
    expect(result.current.data).toBe(1);
    expect(result.current.isLoading).toBe(false);

    await flush(1000);
    expect(result.current.data).toBe(2);
    await flush(1000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  test("fetches once without an interval", async () => {
    const fetcher = vi.fn(async () => "x");
    renderHook(() => usePolling(fetcher, []));
    await flush(10000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("stops when the interval function returns null", async () => {
    let n = 0;
    const fetcher = vi.fn(async () => ++n);
    renderHook(() => usePolling(fetcher, [], { interval: (d) => (d !== undefined && d >= 3 ? null : 100) }));
    await flush(1000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  test("never overlaps requests", async () => {
    let active = 0;
    let maxActive = 0;
    const fetcher = vi.fn(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 2500));
      active--;
      return 1;
    });
    renderHook(() => usePolling(fetcher, [], { interval: 1000 }));
    await flush(10000);
    expect(maxActive).toBe(1);
    // 2.5 s request + 1 s pause per cycle
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(3);
  });

  test("keeps the last data when a poll fails", async () => {
    let call = 0;
    const fetcher = vi.fn(async () => {
      call++;
      if (call === 2) throw new Error("offline");
      return call;
    });
    const { result } = renderHook(() => usePolling(fetcher, [], { interval: 100 }));
    await flush();
    expect(result.current.data).toBe(1);
    await flush(100);
    expect(result.current.data).toBe(1);
    expect(result.current.error?.message).toBe("offline");
    await flush(100);
    expect(result.current.data).toBe(3);
    expect(result.current.error).toBeUndefined();
  });

  test("restarts on deps change and drops stale responses", async () => {
    const fetcher = vi.fn(
      (id: string) => new Promise<string>((resolve) => setTimeout(() => resolve("data-" + id), id === "a" ? 500 : 100)),
    );
    const { result, rerender } = renderHook(({ id }) => usePolling((_signal) => fetcher(id), [id]), {
      initialProps: { id: "a" },
    });

    await flush(50);
    rerender({ id: "b" });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await flush(1000);
    expect(result.current.data).toBe("data-b");
  });

  test("passes an AbortSignal that is aborted on unmount", async () => {
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn((s: AbortSignal) => {
      signal = s;
      return new Promise<number>(() => {});
    });
    const { unmount } = renderHook(() => usePolling(fetcher, [], { interval: 100 }));
    await flush();
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
    await flush(1000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("does nothing while disabled", async () => {
    const fetcher = vi.fn(async () => 1);
    const { result, rerender } = renderHook(({ enabled }) => usePolling(fetcher, [], { enabled, interval: 100 }), {
      initialProps: { enabled: false },
    });
    await flush(1000);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);

    rerender({ enabled: true });
    await flush();
    expect(result.current.data).toBe(1);
  });

  test("pauses while the tab is hidden and catches up when visible", async () => {
    const fetcher = vi.fn(async () => 1);
    renderHook(() => usePolling(fetcher, [], { interval: 100 }));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);

    setHidden(true);
    await flush(1000);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => setHidden(false));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("refresh fetches immediately", async () => {
    let n = 0;
    const fetcher = vi.fn(async () => ++n);
    const { result } = renderHook(() => usePolling(fetcher, [], { interval: 60000 }));
    await flush();
    await act(() => result.current.refresh());
    expect(result.current.data).toBe(2);
  });
});

describe("data hooks", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    vi.useFakeTimers();
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
    vi.useRealTimers();
  });

  test("useTask polls every 500 ms until the task has an endTime", async () => {
    let calls = 0;
    mock.onGet("/tasks/t1").reply(() => {
      calls++;
      return [
        200,
        {
          id: "t1",
          status: calls < 3 ? "RUNNING" : "SUCCESS",
          endTime: calls < 3 ? undefined : "2026-01-01T00:00:00Z",
        },
      ];
    });
    const { result } = renderHook(() => useTask("t1"));
    await flush(POLL.task * 10);
    expect(calls).toBe(3);
    expect(result.current.data?.status).toBe("SUCCESS");
  });

  test("useTask does not fetch without an id", async () => {
    renderHook(() => useTask(undefined));
    await flush(2000);
    expect(mock.history.get).toHaveLength(0);
  });

  test("useTaskLogs stops polling when follow is false", async () => {
    mock.onGet("/tasks/t1/logs").reply(200, { logs: [] });
    const { rerender } = renderHook(({ follow }) => useTaskLogs("t1", { follow }), { initialProps: { follow: true } });
    await flush(POLL.taskLogs * 2);
    expect(mock.history.get).toHaveLength(3);

    rerender({ follow: false });
    await flush(POLL.taskLogs * 3);
    expect(mock.history.get).toHaveLength(4); // one final fetch for the new deps, then no polling
  });

  test("useTasksSummary exposes the running count", async () => {
    mock.onGet("/tasks-summary").reply(200, { RUNNING: 2, SUCCESS: 5 });
    const { result } = renderHook(() => useTasksSummary());
    expect(result.current.runningCount).toBe(0);
    await flush();
    expect(result.current.runningCount).toBe(2);
  });
});
