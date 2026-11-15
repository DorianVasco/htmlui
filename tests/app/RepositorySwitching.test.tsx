import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { apiClient } from "../../src/api";
import { AppRoutes } from "../../src/app/App";
import { rememberRepo, resetKnownReposCache, setActiveRepo } from "../../src/app/knownRepos";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

const CONNECTED = { connected: true, description: "Dev test repository", storage: "filesystem", configFile: "C:\\kopia\\repository.config" };

let mock: MockAdapter;
let connected: boolean;

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  localStorage.clear();
  resetKnownReposCache();
  connected = false;
  mock = new MockAdapter(apiClient);
  mock.onGet("/repo/status").reply(() => [200, connected ? CONNECTED : { connected: false }]);
  mock.onGet("/repo/algorithms").reply(200, { hash: [], encryption: [], ecc: [], splitter: [], compression: [] });
  mock.onGet("/current-user").reply(200, { username: "mail", hostname: "bruno" });
  mock.onGet("/sources").reply(200, { localUsername: "mail", localHost: "bruno", multiUser: false, sources: [] });
  mock.onGet("/tasks-summary").reply(200, {});
});
afterEach(() => mock.restore());

const renderAt = (route: string) => renderWithMantine(<AppRoutes />, { route });
const remember = (path: string, description: string) =>
  rememberRepo({ storage: { type: "filesystem", config: { path } }, description, clientOptions: { username: "mail", hostname: "bruno", readonly: false } });

const disconnectOk = () =>
  mock.onPost("/repo/disconnect").reply(() => {
    connected = false;
    return [200, {}];
  });

describe("quick switching", () => {
  test("switches from the current repository to another known one", async () => {
    remember("D:\\other", "Other repo");
    remember("C:\\kopia-main", "Dev test repository"); // becomes active
    connected = true;
    disconnectOk();
    mock.onPost("/repo/connect").reply(() => {
      connected = true;
      return [200, CONNECTED];
    });
    renderAt("/repo");

    const rows = await screen.findAllByTestId("known-repo");
    expect(rows).toHaveLength(2);
    const current = rows.find((r) => r.textContent?.includes("Dev test repository")) as HTMLElement;
    expect(within(current).getByText("Current")).toBeInTheDocument();
    expect(within(current).queryByRole("button", { name: "Switch" })).not.toBeInTheDocument();

    const other = rows.find((r) => r.textContent?.includes("Other repo")) as HTMLElement;
    await userEvent.click(within(other).getByRole("button", { name: "Switch" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/disconnected from/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Repository password/), "pw");
    await userEvent.click(within(dialog).getByRole("button", { name: "Switch" }));

    expect(await screen.findByText("Nothing is backed up yet.")).toBeInTheDocument();
    expect(mock.history.post.map((r) => r.url)).toEqual(["/repo/disconnect", "/repo/connect"]);
    expect(JSON.parse(mock.history.post[1].data)).toEqual({
      storage: { type: "filesystem", config: { path: "D:\\other" } },
      password: "pw",
      clientOptions: { username: "mail", hostname: "bruno", readonly: false, description: "Other repo" },
    });
    expect(localStorage.getItem("kopia-active-repository")).toBe("filesystem:D:\\other");
    expect(localStorage.getItem("kopia-known-repositories")).not.toContain("pw");
  });

  test("reports a wrong password and that the server is now disconnected", async () => {
    remember("D:\\other", "Other repo");
    remember("C:\\kopia-main", "Dev test repository");
    connected = true;
    disconnectOk();
    mock.onPost("/repo/connect").reply(400, { code: "INVALID_PASSWORD", error: "invalid repository password" });
    renderAt("/repo");

    const other = (await screen.findAllByTestId("known-repo")).find((r) => r.textContent?.includes("Other repo")) as HTMLElement;
    await userEvent.click(within(other).getByRole("button", { name: "Switch" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Repository password/), "wrong");
    await userEvent.click(within(dialog).getByRole("button", { name: "Switch" }));

    expect(await within(dialog).findByText("The password is not correct for this repository.")).toBeInTheDocument();
    expect(within(dialog).getByText(/now not connected to any repository/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });

  test("connects to a recent repository when disconnected, without disconnecting first", async () => {
    remember("D:\\other", "Other repo");
    setActiveRepo(null);
    mock.onPost("/repo/connect").reply(() => {
      connected = true;
      return [200, CONNECTED];
    });
    renderAt("/repo");

    expect(await screen.findByText("Recent repositories")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Repository password/), "pw");
    await userEvent.click(within(dialog).getByRole("button", { name: "Connect" }));

    expect(await screen.findByText("Nothing is backed up yet.")).toBeInTheDocument();
    expect(mock.history.post.map((r) => r.url)).toEqual(["/repo/connect"]);
  });

  test("forget removes a repository from the list only", async () => {
    remember("D:\\other", "Other repo");
    setActiveRepo(null);
    renderAt("/repo");
    await userEvent.click(await screen.findByRole("button", { name: "Forget Other repo" }));
    await waitFor(() => expect(screen.queryByText("Recent repositories")).not.toBeInTheDocument());
    expect(mock.history.post).toHaveLength(0);
  });

  test("the header menu opens the switch dialog", async () => {
    remember("D:\\other", "Other repo");
    remember("C:\\kopia-main", "Dev test repository");
    connected = true;
    renderAt("/snapshots");

    await userEvent.click(await screen.findByRole("button", { name: "Switch repository" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Other repo/ }));
    expect(await screen.findByRole("dialog", { name: /Switch to/ })).toBeInTheDocument();
  });

  test("adding a repository while connected disconnects first and remembers both", async () => {
    remember("C:\\kopia-main", "Dev test repository");
    connected = true;
    disconnectOk();
    mock.onPost("/repo/exists").reply(400, { code: "NOT_INITIALIZED", error: "not initialized" });
    mock.onPost("/repo/create").reply(() => {
      connected = true;
      return [200, CONNECTED];
    });
    renderAt("/repo");

    await userEvent.click(await screen.findByRole("button", { name: "Add repository" }));
    await userEvent.click(await screen.findByRole("button", { name: "Local directory or NAS" }));
    await userEvent.type(await screen.findByLabelText(/^Directory/, { selector: "input" }), "E:\\second");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/will disconnect from/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Repository password/), "pw2");
    await userEvent.type(screen.getByLabelText(/Confirm password/), "pw2");
    await userEvent.click(screen.getByRole("button", { name: "Create repository" }));

    expect(await screen.findByText("Nothing is backed up yet.")).toBeInTheDocument();
    expect(mock.history.post.map((r) => r.url).filter((u) => u?.startsWith("/repo/"))).toEqual(["/repo/exists", "/repo/disconnect", "/repo/create"]);
    expect(JSON.parse(localStorage.getItem("kopia-known-repositories") ?? "[]")).toHaveLength(2);
  });
});
