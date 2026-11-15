import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { apiClient } from "../../src/api";
import { AppRoutes } from "../../src/app/App";
import { resetKnownReposCache } from "../../src/app/knownRepos";
import { counterRows, logParams } from "../../src/app/pages/tasks/taskFormat";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

const TASKS = [
  {
    id: "1",
    kind: "Maintenance",
    description: "Periodic maintenance",
    status: "SUCCESS",
    startTime: "2026-01-01T10:00:00Z",
    endTime: "2026-01-01T10:00:04Z",
  },
  {
    id: "2",
    kind: "Snapshot",
    description: "mail@bruno:/data",
    status: "FAILED",
    startTime: "2026-01-02T10:00:00Z",
    endTime: "2026-01-02T10:01:00Z",
    errorMessage: "disk full",
  },
  {
    id: "3",
    kind: "Snapshot",
    description: "mail@bruno:/home",
    status: "RUNNING",
    startTime: "2026-01-01T09:00:00Z",
    progressInfo: "hashing",
  },
];

let mock: MockAdapter;

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  localStorage.clear();
  resetKnownReposCache();
  mock = new MockAdapter(apiClient);
  mock.onGet("/repo/status").reply(200, { connected: true, description: "Repo", storage: "filesystem" });
  mock.onGet("/tasks-summary").reply(200, { RUNNING: 1 });
  mock.onGet("/ui-preferences").reply(200, {});
  mock.onGet("/tasks").reply(200, { tasks: TASKS });
});
afterEach(() => mock.restore());

const rowTexts = async () => (await screen.findAllByTestId("task-row")).map((r) => r.textContent ?? "");

describe("TasksPage", () => {
  test("lists running tasks first, then newest first", async () => {
    renderWithMantine(<AppRoutes />, { route: "/tasks" });
    const rows = await rowTexts();
    expect(rows[0]).toContain("mail@bruno:/home");
    expect(rows[1]).toContain("disk full");
    expect(rows[2]).toContain("Periodic maintenance");
  });

  test("filters by status from the URL", async () => {
    renderWithMantine(<AppRoutes />, { route: "/tasks?status=failed" });
    const rows = await rowTexts();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("disk full");
  });

  test("cancels a running task", async () => {
    mock.onPost("/tasks/3/cancel").reply(200, {});
    renderWithMantine(<AppRoutes />, { route: "/tasks" });
    const rows = await screen.findAllByTestId("task-row");
    await userEvent.click(within(rows[0]).getByRole("button", { name: "Cancel task" }));
    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toContain("/tasks/3/cancel"));
  });

  test("/tasks/:id shows details, counters and the log", async () => {
    mock.onGet("/tasks/2").reply(200, {
      ...TASKS[1],
      counters: {
        Errors: { value: 2, level: "error" },
        "Hashed Bytes": { value: 2000, units: "bytes" },
        Skipped: { value: 0 },
      },
    });
    mock.onGet("/tasks/2/logs").reply(200, {
      logs: [
        { level: 0, ts: 1767348000, mod: "uploader", msg: "uploading", parallel: 8 },
        { level: 3, ts: 1767348001, mod: "uploader", msg: "write failed" },
      ],
    });
    renderWithMantine(<AppRoutes />, { route: "/tasks/2" });
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("Snapshot · task 2")).toBeInTheDocument();
    expect(within(drawer).getByText("disk full")).toBeInTheDocument();
    expect(within(drawer).getByText(/^2(.0)? KB$/)).toBeInTheDocument();
    expect(within(drawer).queryByText("Skipped")).not.toBeInTheDocument();
    const log = await within(drawer).findByTestId("task-log");
    expect(log).toHaveTextContent("uploading");
    expect(log).toHaveTextContent('{"parallel":8}');
    expect(log).toHaveTextContent("write failed");
  });
});

describe("task formatting", () => {
  test("counter rows skip zeros and put errors first", () => {
    const rows = counterRows({ "A files": { value: 3 }, Errors: { value: 1, level: "error" }, Zero: { value: 0 } });
    expect(rows.map((r) => r.label)).toEqual(["Errors", "A files"]);
  });

  test("log params exclude the standard fields", () => {
    expect(logParams({ msg: "x", ts: 1, level: 0, mod: "m" })).toBe("");
    expect(logParams({ msg: "x", ts: 1, level: 0, mod: "m", path: "/a" })).toBe('{"path":"/a"}');
  });
});
