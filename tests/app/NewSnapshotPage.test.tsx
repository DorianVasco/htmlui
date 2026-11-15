import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { apiClient } from "../../src/api";
import { AppRoutes } from "../../src/app/App";
import { resetKnownReposCache } from "../../src/app/knownRepos";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

const SOURCE_Q = "userName=mail&host=bruno&path=%2Fdata%2Fdocs";

let mock: MockAdapter;
let sources: unknown[];

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  localStorage.clear();
  resetKnownReposCache();
  sources = [];
  mock = new MockAdapter(apiClient);
  mock.onGet("/repo/status").reply(200, { connected: true, description: "Repo", storage: "filesystem" });
  mock.onGet("/tasks-summary").reply(200, {});
  mock.onGet("/sources").reply(() => [200, { localUsername: "mail", localHost: "bruno", multiUser: false, sources }]);
  mock.onPost("/paths/resolve").reply((config) => [200, { source: { userName: "mail", host: "bruno", path: JSON.parse(config.data).path } }]);
  mock.onGet("/policy?" + SOURCE_Q).reply(404, { code: "NOT_FOUND", error: "not found" });
  mock.onPost("/policy/resolve?" + SOURCE_Q).reply(200, {
    effective: {
      retention: { keepLatest: 10, keepDaily: 7 },
      scheduling: { intervalSeconds: 3600 },
      compression: { compressorName: "zstd" },
      files: { ignore: [".git"] },
    },
    definition: {},
    upcomingSnapshotTimes: [],
  });
});
afterEach(() => mock.restore());

const renderPage = () => renderWithMantine(<AppRoutes />, { route: "/snapshots/new" });

async function enterPath(path = "/data/docs") {
  await userEvent.type(await screen.findByLabelText(/Folder to back up/, { selector: "input" }), path);
  expect(await screen.findByTestId("resolved-source", {}, { timeout: 3000 })).toHaveTextContent("mail@bruno:/data/docs");
}

describe("NewSnapshotPage", () => {
  test("resolves the path, previews the effective policy and creates the source with a snapshot", async () => {
    mock.onPost("/sources").reply(200, { snapshotStarted: true });
    renderPage();
    await enterPath();

    expect(await screen.findByText("10 latest, 7 daily")).toBeInTheDocument();
    expect(screen.getByText("every 1 h")).toBeInTheDocument();
    expect(screen.getByText("zstd")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Snapshot now" });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/sources")).toBe(true));
    const body = JSON.parse(mock.history.post.find((r) => r.url === "/sources")!.data);
    // No policy of its own yet: the server still needs one, so an empty definition is sent.
    expect(body).toEqual({ path: "/data/docs", createSnapshot: true, policy: {} });
    expect(await screen.findByText("Nothing is backed up yet.")).toBeInTheDocument();
  });

  test("sends the folder's existing policy definition so it is not overwritten", async () => {
    mock.onGet("/policy?" + SOURCE_Q).reply(200, { retention: { keepLatest: 3 } });
    mock.onPost("/sources").reply(200, {});
    renderPage();
    await enterPath();

    const add = screen.getByRole("button", { name: "Add without snapshot" });
    await waitFor(() => expect(add).toBeEnabled());
    await userEvent.click(add);

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/sources")).toBe(true));
    expect(JSON.parse(mock.history.post.find((r) => r.url === "/sources")!.data)).toEqual({
      path: "/data/docs",
      createSnapshot: false,
      policy: { retention: { keepLatest: 3 } },
    });
  });

  test("starts a snapshot instead of re-creating an already backed-up folder", async () => {
    sources = [{ source: { userName: "mail", host: "bruno", path: "/data/docs" }, status: "IDLE" }];
    mock.onPost("/sources/upload?" + SOURCE_Q).reply(200, {});
    renderPage();
    await enterPath();

    expect(await screen.findByText(/already being backed up/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add without snapshot" })).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Snapshot now" });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toContain("/sources/upload?" + SOURCE_Q));
    expect(mock.history.post.some((r) => r.url === "/sources")).toBe(false);
  });

  test("estimates the size via an estimate task", async () => {
    mock.onPost("/estimate").reply(200, { id: "est1", status: "RUNNING" });
    mock.onGet("/tasks/est1").reply(200, {
      id: "est1",
      status: "SUCCESS",
      startTime: "2026-01-01T00:00:00Z",
      endTime: "2026-01-01T00:00:03Z",
      counters: { Bytes: { value: 2000000 }, Files: { value: 1234 }, Directories: { value: 56 }, Errors: { value: 0 }, "Excluded Files": { value: 7 } },
    });
    renderPage();
    await enterPath();

    const button = screen.getByRole("button", { name: "Estimate size" });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    const result = await screen.findByTestId("estimate-result");
    expect(await screen.findByText("2 MB")).toBeInTheDocument();
    expect(result).toHaveTextContent(/1[,.]234/); // locale-dependent separator
    expect(result).toHaveTextContent("7 excluded");
    expect(JSON.parse(mock.history.post.find((r) => r.url === "/estimate")!.data)).toEqual({ root: "/data/docs", maxExamplesPerBucket: 10, policyOverride: {} });
  });

  test("explains a folder that does not exist", async () => {
    mock.onPost("/sources").reply(400, { code: "PATH_NOT_FOUND", error: "path does not exist" });
    renderPage();
    await enterPath();
    const button = screen.getByRole("button", { name: "Snapshot now" });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    expect(await screen.findByText("This folder does not exist on the server's computer.")).toBeInTheDocument();
  });

  test("the dashboard's New snapshot button opens this page", async () => {
    renderWithMantine(<AppRoutes />, { route: "/snapshots" });
    await userEvent.click((await screen.findAllByRole("link", { name: /New snapshot|Create your first snapshot/ }))[0]);
    expect(await screen.findByLabelText(/Folder to back up/, { selector: "input" })).toBeInTheDocument();
  });
});
