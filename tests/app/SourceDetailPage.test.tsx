import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { apiClient } from "../../src/api";
import { AppRoutes } from "../../src/app/App";
import { resetKnownReposCache } from "../../src/app/knownRepos";
import { DEFAULT_RESTORE_OPTIONS, restoreRequest } from "../../src/app/pages/source/RestoreModal";
import { sourceDetailPath } from "../../src/app/pages/source/SourceDetailPage";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

const SOURCE = { userName: "mail", host: "bruno", path: "/data/docs" };
const Q = "userName=mail&host=bruno&path=%2Fdata%2Fdocs";

const snap = (id: string, startTime: string, extra: Record<string, unknown> = {}) => ({
  id,
  source: SOURCE,
  startTime,
  rootID: "root-" + id,
  retention: [],
  pins: [],
  summary: { size: 1000, files: 3 },
  ...extra,
});

let mock: MockAdapter;

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  localStorage.clear();
  resetKnownReposCache();
  mock = new MockAdapter(apiClient);
  mock.onGet("/repo/status").reply(200, { connected: true, description: "Repo", storage: "filesystem" });
  mock.onGet("/tasks-summary").reply(200, {});
  mock.onGet("/ui-preferences").reply(200, {});
  mock.onGet("/sources").reply(200, {
    localUsername: "mail",
    localHost: "bruno",
    multiUser: false,
    sources: [{ source: SOURCE, status: "IDLE", lastSnapshot: null, nextSnapshotTime: null }],
  });
  mock.onGet("/snapshots?" + Q).reply(200, {
    snapshots: [
      snap("old", "2026-01-01T10:00:00Z", { retention: ["monthly-1"] }),
      snap("new", "2026-03-01T10:00:00Z", {
        retention: ["latest-1", "daily-1"],
        pins: ["keep"],
        description: "Before cleanup",
      }),
    ],
    unfilteredCount: 3,
    uniqueCount: 2,
  });
});
afterEach(() => mock.restore());

const renderPage = () => renderWithMantine(<AppRoutes />, { route: sourceDetailPath(SOURCE) });

describe("SourceDetailPage", () => {
  test("lists snapshots newest first with retention, pins and hidden count", async () => {
    renderPage();
    const rows = await screen.findAllByTestId("snapshot-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Before cleanup")).toBeInTheDocument();
    expect(within(rows[0]).getByText("latest-1")).toBeInTheDocument();
    expect(within(rows[0]).getByLabelText("Pinned")).toBeInTheDocument();
    expect(within(rows[1]).getByText("monthly-1")).toBeInTheDocument();
    expect(screen.getByText("1 pinned · 1 hidden")).toBeInTheDocument();
  });

  test("shows identical snapshots on request", async () => {
    renderPage();
    await screen.findAllByTestId("snapshot-row");
    mock.onGet("/snapshots?" + Q + "&all=1").reply(200, { snapshots: [], unfilteredCount: 3, uniqueCount: 2 });
    await userEvent.click(screen.getByLabelText("Show identical"));
    await waitFor(() => expect(mock.history.get.some((r) => r.url === "/snapshots?" + Q + "&all=1")).toBe(true));
  });

  test("deletes the selected snapshots after confirmation", async () => {
    mock.onPost("/snapshots/delete").reply(200, {});
    renderPage();
    const rows = await screen.findAllByTestId("snapshot-row");
    await userEvent.click(within(rows[1]).getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /Delete 1/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mock.history.post.find((r) => r.url === "/snapshots/delete")).toBeDefined());
    const req = JSON.parse(mock.history.post.find((r) => r.url === "/snapshots/delete")!.data);
    expect(req).toEqual({ source: SOURCE, snapshotManifestIds: ["old"] });
  });

  test("browses into folders and restores one of them", async () => {
    mock.onGet("/objects/root-new").reply(200, {
      entries: [
        { name: "notes.txt", type: "f", size: 10, obj: "file1" },
        { name: "Invoices", type: "d", obj: "dir1", summ: { size: 500 } },
      ],
    });
    mock.onGet("/objects/dir1").reply(200, { entries: [{ name: "a.pdf", type: "f", size: 5, obj: "file2" }] });
    mock.onGet("/mounts/root-new").reply(404, { code: "NOT_FOUND", error: "not mounted" });
    mock.onPost("/restore").reply(200, { id: "task-1", status: "RUNNING" });

    renderPage();
    const rows = await screen.findAllByTestId("snapshot-row");
    await userEvent.click(within(rows[0]).getByRole("button", { name: "Browse files" }));

    const drawer = await screen.findByRole("dialog");
    // Folders are listed first.
    const names = (await within(drawer).findAllByRole("row")).map((r) => r.textContent);
    expect(names[0]).toContain("Invoices");
    expect(within(drawer).getByRole("link", { name: "Download notes.txt" })).toHaveAttribute(
      "href",
      "/api/v1/objects/file1?fname=notes.txt",
    );

    await userEvent.click(within(drawer).getByText("Invoices"));
    expect(await within(drawer).findByText("a.pdf")).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole("button", { name: "Restore this folder…" }));

    const input = await screen.findByLabelText("Restore to");
    expect(input).toHaveValue("/data/docs (restored)/Invoices");
    await userEvent.click(screen.getByRole("button", { name: "Start restore" }));
    await waitFor(() => expect(mock.history.post.find((r) => r.url === "/restore")).toBeDefined());
    const req = JSON.parse(mock.history.post.find((r) => r.url === "/restore")!.data);
    expect(req.root).toBe("dir1");
    expect(req.fsOutput.targetPath).toBe("/data/docs (restored)/Invoices");
  });
});

describe("restoreRequest", () => {
  test("maps options to a filesystem restore", () => {
    const req = restoreRequest("oid", " C:\\out ", {
      ...DEFAULT_RESTORE_OPTIONS,
      overwrite: true,
      restoreOwners: false,
    });
    expect(req.fsOutput).toMatchObject({
      targetPath: "C:\\out",
      overwriteFiles: true,
      overwriteDirectories: true,
      skipOwners: true,
      skipPermissions: false,
    });
    expect(req.options).toMatchObject({ incremental: true, ignoreErrors: false });
  });

  test("creates archives for .zip and .tar destinations", () => {
    expect(restoreRequest("oid", "/tmp/x.ZIP", DEFAULT_RESTORE_OPTIONS)).toMatchObject({
      zipFile: "/tmp/x.ZIP",
      uncompressedZip: true,
    });
    expect(restoreRequest("oid", "/tmp/x.tar", DEFAULT_RESTORE_OPTIONS)).toMatchObject({ tarFile: "/tmp/x.tar" });
    expect(restoreRequest("oid", "/tmp/x.tar", DEFAULT_RESTORE_OPTIONS).fsOutput).toBeUndefined();
  });
});
