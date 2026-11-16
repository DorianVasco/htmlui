import React from "react";
import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { apiClient } from "../../src/api";
import { AppRoutes } from "../../src/app/App";
import { CliEquivalent, cliPolicyTarget, q, setShowCli } from "../../src/app/cli";
import { resetKnownReposCache } from "../../src/app/knownRepos";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

let mock: MockAdapter;

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  localStorage.clear();
  resetKnownReposCache();
  mock = new MockAdapter(apiClient);
  mock.onGet("/cli").reply(200, { executable: "/usr/bin/kopia --config-file=/x.config" });
});
afterEach(() => {
  mock.restore();
  act(() => setShowCli(false));
});

describe("CLI equivalents", () => {
  test("hidden until switched on, then shows the command with the full executable to copy", async () => {
    renderWithMantine(<CliEquivalent command="snapshot list" />);
    expect(screen.queryByTestId("cli-equivalent")).not.toBeInTheDocument();

    act(() => setShowCli(true));
    expect(await screen.findByTestId("cli-equivalent")).toHaveTextContent("kopia snapshot list");
    expect(await screen.findByTitle("/usr/bin/kopia --config-file=/x.config snapshot list")).toBeInTheDocument();
    expect(localStorage.getItem("kopia-show-cli")).toBe("1");
  });

  test("formats policy targets and quotes arguments", () => {
    expect(cliPolicyTarget({ userName: "", host: "", path: "" })).toBe("--global");
    expect(cliPolicyTarget({ userName: "", host: "nas", path: "" })).toBe("@nas");
    expect(cliPolicyTarget({ userName: "me", host: "nas", path: "" })).toBe("me@nas");
    expect(cliPolicyTarget({ userName: "me", host: "pc", path: "C:\\My Files" })).toBe('"me@pc:C:\\My Files"');
    expect(q("/data")).toBe("/data");
    expect(q('a "b"')).toBe('"a \\"b\\""');
  });
});

describe("sidebar", () => {
  test("shows the number of running tasks next to Tasks", async () => {
    mock.onGet("/repo/status").reply(200, { connected: true, description: "Repo", storage: "filesystem" });
    mock.onGet("/tasks-summary").reply(200, { RUNNING: 2 });
    mock.onGet("/sources").reply(200, { localUsername: "me", localHost: "pc", multiUser: false, sources: [] });
    renderWithMantine(<AppRoutes />, { route: "/snapshots" });
    const badges = await screen.findAllByLabelText("2 running");
    expect(badges.length).toBeGreaterThan(0);
  });
});
