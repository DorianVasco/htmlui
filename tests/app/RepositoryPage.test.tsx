import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { ApiError, apiClient } from "../../src/api";
import { AppRoutes } from "../../src/app/App";
import { isMissingDirectory } from "../../src/app/pages/repository/SetupWizard";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

const ALGORITHMS = {
  defaultHash: "BLAKE2B-256-128",
  defaultEncryption: "AES256-GCM-HMAC-SHA256",
  defaultEcc: "REED-SOLOMON-CRC32",
  defaultSplitter: "DYNAMIC-4M-BUZHASH",
  hash: [{ id: "BLAKE2B-256-128" }, { id: "BLAKE3-256" }],
  encryption: [{ id: "AES256-GCM-HMAC-SHA256" }, { id: "CHACHA20-POLY1305-HMAC-SHA256" }],
  ecc: [{ id: "REED-SOLOMON-CRC32" }],
  splitter: [{ id: "DYNAMIC-4M-BUZHASH" }],
  compression: [],
};

const CONNECTED = {
  connected: true,
  description: "Dev test repository",
  configFile: "C:\\kopia\\repository.config",
  storage: "filesystem",
  hash: "BLAKE2B-256-128",
  encryption: "AES256-GCM-HMAC-SHA256",
  splitter: "DYNAMIC-4M-BUZHASH",
  formatVersion: 3,
  username: "mail",
  hostname: "bruno",
};

let mock: MockAdapter;
let connected: boolean;

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  connected = false;
  mock = new MockAdapter(apiClient);
  mock.onGet("/repo/status").reply(() => [200, connected ? CONNECTED : { connected: false }]);
  mock.onGet("/repo/algorithms").reply(200, ALGORITHMS);
  mock.onGet("/current-user").reply(200, { username: "mail", hostname: "bruno" });
  mock.onGet("/sources").reply(200, { localUsername: "mail", localHost: "bruno", multiUser: false, sources: [] });
  mock.onGet("/tasks-summary").reply(200, {});
});
afterEach(() => mock.restore());

const renderAt = (route: string) => renderWithMantine(<AppRoutes />, { route });

async function goToLocation(path: string) {
  await userEvent.click(await screen.findByRole("button", { name: "Local directory or NAS" }));
  await userEvent.type(await screen.findByRole("textbox", { name: /Directory/ }), path);
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("repository setup wizard", () => {
  test("creates a new filesystem repository with default options", async () => {
    mock.onPost("/repo/exists").reply(400, { code: "NOT_INITIALIZED", error: "repository not initialized" });
    mock.onPost("/repo/create").reply(() => {
      connected = true;
      return [200, CONNECTED];
    });
    renderAt("/repo");

    await goToLocation("D:\\Backups\\kopia");
    expect(await screen.findByText("A new repository will be created")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Repository password/), "secret-1");
    await userEvent.type(screen.getByLabelText(/Confirm password/), "secret-2");
    await userEvent.click(screen.getByRole("button", { name: "Create repository" }));
    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(mock.history.post.filter((r) => r.url === "/repo/create")).toHaveLength(0);

    await userEvent.clear(screen.getByLabelText(/Confirm password/));
    await userEvent.type(screen.getByLabelText(/Confirm password/), "secret-1");
    await userEvent.click(screen.getByRole("button", { name: "Create repository" }));

    // After creating, the app refreshes the status and shows the dashboard.
    expect(await screen.findByText("Nothing is backed up yet.")).toBeInTheDocument();

    const body = JSON.parse(mock.history.post.find((r) => r.url === "/repo/create")!.data);
    expect(body.storage).toEqual({ type: "filesystem", config: { path: "D:\\Backups\\kopia" } });
    expect(body.password).toBe("secret-1");
    expect(body.clientOptions).toEqual({ description: "My Repository", username: "mail", hostname: "bruno", readonly: false });
    expect(body.options.blockFormat).toEqual({
      hash: "BLAKE2B-256-128",
      encryption: "AES256-GCM-HMAC-SHA256",
      ecc: "REED-SOLOMON-CRC32",
      eccOverheadPercent: 0,
    });
    expect(body.options.blockFormat.version).toBeUndefined(); // server picks its current format
    expect(body.options.objectFormat).toEqual({ splitter: "DYNAMIC-4M-BUZHASH" });
  });

  test("treats a missing directory as a new repository", async () => {
    mock.onPost("/repo/exists").reply(500, {
      code: "INTERNAL",
      error: "internal server error: cannot access storage path: GetFileAttributesEx D:\\new: The system cannot find the file specified.",
    });
    renderAt("/repo");
    await goToLocation("D:\\new");
    expect(await screen.findByText(/the folder will be created/)).toBeInTheDocument();
  });

  test("shows other storage errors on the location step", async () => {
    mock.onPost("/repo/exists").reply(500, { code: "INTERNAL", error: "access denied" });
    renderAt("/repo");
    await goToLocation("C:\\Windows");
    expect(await screen.findByText(/access denied/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  test("connects to an existing repository and reports a wrong password", async () => {
    mock.onPost("/repo/exists").reply(200, {});
    mock.onPost("/repo/connect").replyOnce(400, { code: "INVALID_PASSWORD", error: "invalid repository password" });
    mock.onPost("/repo/connect").reply(() => {
      connected = true;
      return [200, CONNECTED];
    });
    renderAt("/repo");

    await goToLocation("D:\\Backups\\kopia");
    expect(await screen.findByText("Existing repository found")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Confirm password/)).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Repository password/), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("The password is not correct for this repository.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Nothing is backed up yet.")).toBeInTheDocument();
    const body = JSON.parse(mock.history.post.filter((r) => r.url === "/repo/connect")[1].data);
    expect(body.options).toBeUndefined();
    expect(body.storage.type).toBe("filesystem");
  });

  test("the not-connected dashboard links to the setup page", async () => {
    renderAt("/snapshots");
    await userEvent.click(await screen.findByRole("link", { name: "Set up repository" }));
    expect(await screen.findByText("Set up a repository")).toBeInTheDocument();
  });
});

describe("connected repository page", () => {
  test("shows details and saves the description", async () => {
    connected = true;
    mock.onPost("/repo/description").reply(200, {});
    renderAt("/repo");

    expect(await screen.findByText("C:\\kopia\\repository.config")).toBeInTheDocument();
    expect(screen.getByText("mail@bruno")).toBeInTheDocument();

    const input = screen.getByLabelText("Description");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Save description" }));
    await waitFor(() => expect(mock.history.post.find((r) => r.url === "/repo/description")?.data).toBe(JSON.stringify({ description: "Renamed" })));
  });

  test("disconnects after confirmation", async () => {
    connected = true;
    mock.onPost("/repo/disconnect").reply(() => {
      connected = false;
      return [200, {}];
    });
    renderAt("/repo");

    await userEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    const dialog = await screen.findByRole("dialog");
    expect(mock.history.post).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));

    expect(await screen.findByText("Set up a repository")).toBeInTheDocument();
    expect(mock.history.post.map((r) => r.url)).toEqual(["/repo/disconnect"]);
  });
});

test("isMissingDirectory recognizes Windows and Unix messages only", () => {
  const e = (msg: string) => new ApiError(msg, 500, "INTERNAL");
  expect(isMissingDirectory(e("cannot access storage path: GetFileAttributesEx X: The system cannot find the file specified."))).toBe(true);
  expect(isMissingDirectory(e("cannot access storage path: stat /x: no such file or directory"))).toBe(true);
  expect(isMissingDirectory(e("cannot access storage path: permission denied"))).toBe(false);
  expect(isMissingDirectory(new Error("no such file or directory"))).toBe(false);
});
