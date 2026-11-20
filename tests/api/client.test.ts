import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import MockAdapter from "axios-mock-adapter";
import {
  ApiError,
  apiClient,
  createApiClient,
  CSRF_HEADER,
  isNotConnected,
  onNotConnected,
  sourceQuery,
} from "../../src/api/client";
import * as api from "../../src/api/endpoints";

function setCsrfMeta(value: string | null) {
  document.head.querySelectorAll('meta[name="kopia-csrf-token"]').forEach((m) => m.remove());
  if (value !== null) {
    const m = document.createElement("meta");
    m.name = "kopia-csrf-token";
    m.content = value;
    document.head.appendChild(m);
  }
}

describe("api client", () => {
  afterEach(() => setCsrfMeta(null));

  test("sends the CSRF token from the meta tag", async () => {
    setCsrfMeta("tok-123");
    const client = createApiClient();
    const mock = new MockAdapter(client);
    mock.onGet("/repo/status").reply((config) => [200, { header: config.headers?.[CSRF_HEADER] }]);

    const res = await client.get("/repo/status");
    expect(res.data.header).toBe("tok-123");
    expect(res.config.baseURL).toBe("/api/v1");
  });

  test("falls back to '-' without a CSRF meta tag", async () => {
    const client = createApiClient();
    const mock = new MockAdapter(client);
    mock.onGet("/x").reply((config) => [200, config.headers?.[CSRF_HEADER]]);
    expect((await client.get("/x")).data).toBe("-");
  });

  test("turns server errors into ApiError with message and code", async () => {
    const client = createApiClient();
    const mock = new MockAdapter(client);
    mock.onGet("/sources").reply(500, { error: "boom", code: "INTERNAL" });

    const err = await client.get("/sources").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("boom");
    expect(err.code).toBe("INTERNAL");
    expect(err.status).toBe(500);
  });

  test("calls the NOT_CONNECTED handler and still rejects", async () => {
    const client = createApiClient();
    const mock = new MockAdapter(client);
    mock.onGet("/sources").reply(400, { error: "not connected", code: "NOT_CONNECTED" });
    const handler = vi.fn();
    const off = onNotConnected(handler);

    const err = await client.get("/sources").catch((e) => e);
    expect(isNotConnected(err)).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);

    off();
    await client.get("/sources").catch(() => {});
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test("sourceQuery encodes parts and treats missing ones as empty", () => {
    expect(sourceQuery({ userName: "me", host: "pc", path: "C:\\My Docs" })).toBe(
      "userName=me&host=pc&path=C%3A%5CMy%20Docs",
    );
    expect(sourceQuery({ host: "nas" })).toBe("userName=&host=nas&path=");
  });
});

describe("endpoints", () => {
  let mock: MockAdapter;
  const src = { userName: "me", host: "pc", path: "/data" };
  const q = "userName=me&host=pc&path=%2Fdata";

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  test("snapshots.list adds all=1 only when requested", async () => {
    mock.onGet("/snapshots?" + q).reply(200, { snapshots: [], unfilteredCount: 0, uniqueCount: 0 });
    mock
      .onGet("/snapshots?" + q + "&all=1")
      .reply(200, { snapshots: [{ id: "a" }], unfilteredCount: 1, uniqueCount: 1 });

    expect((await api.snapshots.list(src)).snapshots).toHaveLength(0);
    expect((await api.snapshots.list(src, { all: true })).snapshots).toHaveLength(1);
  });

  test("sources.upload and cancel post to the source query URL", async () => {
    mock.onPost("/sources/upload?" + q).reply(200, {});
    mock.onPost("/sources/cancel?" + q).reply(200, {});
    await api.sources.upload(src);
    await api.sources.cancel(src);
    expect(mock.history.post.map((r) => r.url)).toEqual(["/sources/upload?" + q, "/sources/cancel?" + q]);
  });

  test("policies.resolve sends updates and number of upcoming times", async () => {
    mock.onPost("/policy/resolve?" + q).reply(200, { effective: {}, definition: {} });
    await api.policies.resolve(src, { retention: { keepLatest: 3 } });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      updates: { retention: { keepLatest: 3 } },
      numUpcomingSnapshotTimes: 5,
    });
  });

  test("policies save/delete use PUT/DELETE on the policy URL", async () => {
    mock.onPut("/policy?userName=&host=nas&path=").reply(200, {});
    mock.onDelete("/policy?userName=&host=nas&path=").reply(200, {});
    await api.policies.save({ host: "nas" }, { a: 1 });
    await api.policies.delete({ host: "nas" });
    expect(mock.history.put).toHaveLength(1);
    expect(mock.history.delete).toHaveLength(1);
  });

  test("snapshots.deleteSource deletes source and policy", async () => {
    mock.onPost("/snapshots/delete").reply(200, {});
    await api.snapshots.deleteSource(src);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ source: src, deleteSourceAndPolicy: true });
  });

  test("objects.downloadUrl builds a direct link", () => {
    expect(api.objects.downloadUrl("abc", "my file.txt")).toBe("/api/v1/objects/abc?fname=my%20file.txt");
    expect(api.objects.downloadUrl("abc")).toBe("/api/v1/objects/abc");
  });
});
