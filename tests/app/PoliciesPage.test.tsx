import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { apiClient } from "../../src/api";
import { AppRoutes } from "../../src/app/App";
import { resetKnownReposCache } from "../../src/app/knownRepos";
import {
  cleanPolicy,
  definedSections,
  parsePolicyTarget,
  parseTimeOfDay,
  policyEditorPath,
  setPath,
} from "../../src/app/pages/policies/policyModel";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

const GLOBAL = { userName: "", host: "", path: "" };
const FOLDER = { userName: "mail", host: "bruno", path: "/data" };
const FOLDER_Q = "userName=mail&host=bruno&path=%2Fdata";

let mock: MockAdapter;

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  localStorage.clear();
  resetKnownReposCache();
  mock = new MockAdapter(apiClient);
  mock.onGet("/repo/status").reply(200, { connected: true, description: "Repo", storage: "filesystem" });
  mock.onGet("/tasks-summary").reply(200, {});
  mock.onGet("/ui-preferences").reply(200, {});
  mock.onGet("/repo/algorithms").reply(200, { compression: [{ id: "zstd" }, { id: "pgzip", deprecated: true }] });
  mock.onGet("/sources").reply(200, { localUsername: "mail", localHost: "bruno", multiUser: false, sources: [] });
  mock.onGet("/policies").reply(200, {
    policies: [
      { target: FOLDER, policy: { files: { ignore: ["*.tmp"] } } },
      { target: { userName: "", host: "other", path: "" }, policy: { upload: { maxParallelSnapshots: 1 } } },
      { target: GLOBAL, policy: { retention: { keepLatest: 10 }, scheduling: { intervalSeconds: 3600 } } },
    ],
  });
  mock.onPost(/^\/policy\/resolve\?/).reply((config) => {
    const updates = JSON.parse(config.data).updates;
    const latest = updates.retention?.keepLatest;
    return [
      200,
      {
        effective: { retention: { keepLatest: latest ?? 10 } },
        definition: { retention: { keepLatest: latest !== undefined ? FOLDER : GLOBAL } },
        upcomingSnapshotTimes: [],
      },
    ];
  });
});
afterEach(() => mock.restore());

describe("PoliciesPage", () => {
  test("lists this computer's policies, global first, with what they define", async () => {
    renderWithMantine(<AppRoutes />, { route: "/policies" });
    const rows = await screen.findAllByTestId("policy-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Global policy");
    expect(rows[0]).toHaveTextContent("Retention");
    expect(rows[0]).toHaveTextContent("Schedule");
    expect(rows[1]).toHaveTextContent("/data");

    await userEvent.click(screen.getByText("All"));
    expect(await screen.findAllByTestId("policy-row")).toHaveLength(3);
  });

  test("new policy checks the target before opening the editor", async () => {
    mock.onGet("/policy?userName=&host=nas&path=").reply(404, { code: "NOT_FOUND", error: "not found" });
    renderWithMantine(<AppRoutes />, { route: "/policies" });
    await screen.findAllByTestId("policy-row");
    await userEvent.click(screen.getByRole("button", { name: "New policy" }));
    const input = await screen.findByLabelText("Applies to");
    await userEvent.type(input, "relative/path");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/Relative paths can't have policies/)).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "@nas");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("button", { name: "Create policy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete policy" })).not.toBeInTheDocument();
  });

  test("editor shows where values come from and saves the definition", async () => {
    mock.onGet("/policy?" + FOLDER_Q).reply(200, { files: { ignore: ["*.tmp", ""] } });
    mock.onPut("/policy?" + FOLDER_Q).reply(200, {});
    renderWithMantine(<AppRoutes />, { route: policyEditorPath(FOLDER) });

    await userEvent.click(await screen.findByRole("tab", { name: "Retention" }));
    expect(await screen.findByTestId("effective-retention.keepLatest")).toHaveTextContent(
      "Effective: 10 · from Global policy",
    );

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Latest"), "5");
    await waitFor(
      () => expect(screen.getByTestId("effective-retention.keepLatest")).toHaveTextContent("Effective: 5 · set here"),
      {
        timeout: 2000,
      },
    );

    await userEvent.click(save);
    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({
      files: { ignore: ["*.tmp"] },
      retention: { keepLatest: 5 },
    });
  });

  test("deletes a policy after confirmation", async () => {
    mock.onGet("/policy?" + FOLDER_Q).reply(200, { files: { ignore: ["*.tmp"] } });
    mock.onDelete("/policy?" + FOLDER_Q).reply(200, {});
    renderWithMantine(<AppRoutes />, { route: policyEditorPath(FOLDER) });
    await userEvent.click(await screen.findByRole("button", { name: "Delete policy" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete policy?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
  });
});

describe("policy model", () => {
  const local = { userName: "mail", host: "bruno" };

  test("parses policy targets like the server", () => {
    expect(parsePolicyTarget("C:\\Data", local)).toEqual({ userName: "mail", host: "bruno", path: "C:\\Data" });
    expect(parsePolicyTarget("/home/me", local)).toEqual({ userName: "mail", host: "bruno", path: "/home/me" });
    expect(parsePolicyTarget("@nas", local)).toEqual({ userName: "", host: "nas", path: "" });
    expect(parsePolicyTarget("root@nas", local)).toEqual({ userName: "root", host: "nas", path: "" });
    expect(parsePolicyTarget("root@nas:/srv", local)).toEqual({ userName: "root", host: "nas", path: "/srv" });
    expect(parsePolicyTarget("docs", local)).toHaveProperty("error");
    expect(parsePolicyTarget("root@", local)).toHaveProperty("error");
    expect(parsePolicyTarget("root@nas:srv", local)).toHaveProperty("error");
  });

  test("setPath removes empty values and parents", () => {
    const p = setPath({ retention: { keepLatest: 3 } }, "retention.keepLatest", undefined);
    expect(p).toEqual({});
    expect(setPath({}, "files.ignoreCacheDirs", false)).toEqual({ files: { ignoreCacheDirs: false } });
  });

  test("cleanPolicy drops blank entries and script-less actions, defaults timeouts", () => {
    expect(
      cleanPolicy({
        files: { ignore: [" a ", ""] },
        compression: { neverCompress: [""] },
        actions: { beforeFolder: { mode: "optional" }, afterSnapshotRoot: { script: "x.sh" } },
      }),
    ).toEqual({ files: { ignore: ["a"] }, actions: { afterSnapshotRoot: { script: "x.sh", timeout: 300 } } });
  });

  test("summarises defined sections and parses times of day", () => {
    expect(definedSections({ retention: { keepLatest: 1 }, files: {}, noParent: true })).toEqual([
      "Retention",
      "No inheritance",
    ]);
    expect(parseTimeOfDay("2:05")).toEqual({ hour: 2, min: 5 });
    expect(parseTimeOfDay("24:00")).toBeNull();
    expect(parseTimeOfDay("7:5")).toBeNull();
  });
});
