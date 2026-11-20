import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { apiClient } from "../../src/api";
import { AppRoutes } from "../../src/app/App";
import { resetKnownReposCache } from "../../src/app/knownRepos";
import { cleanConfig, storageType, validateConfig } from "../../src/app/pages/repository/storageTypes";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

let mock: MockAdapter;
let connected: boolean;

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  localStorage.clear();
  resetKnownReposCache();
  connected = false;
  mock = new MockAdapter(apiClient);
  mock
    .onGet("/repo/status")
    .reply(() => [200, connected ? { connected: true, description: "R" } : { connected: false }]);
  mock
    .onGet("/repo/algorithms")
    .reply(200, { defaultHash: "H", defaultEncryption: "E", defaultEcc: "C", defaultSplitter: "S" });
  mock.onGet("/current-user").reply(200, { username: "mail", hostname: "bruno" });
  mock.onGet("/sources").reply(200, { localUsername: "mail", localHost: "bruno", multiUser: false, sources: [] });
  mock.onGet("/tasks-summary").reply(200, {});
});
afterEach(() => mock.restore());

const posted = (url: string) => mock.history.post.filter((r) => r.url === url).map((r) => JSON.parse(r.data));

async function pick(label: string) {
  renderWithMantine(<AppRoutes />, { route: "/repo" });
  await userEvent.click(await screen.findByRole("button", { name: label }));
}

describe("storage types in the setup wizard", () => {
  test("S3: checks required fields, then creates the repository with the bucket settings", async () => {
    mock.onPost("/repo/exists").reply(400, { code: "NOT_INITIALIZED", error: "not initialized" });
    mock.onPost("/repo/create").reply(() => {
      connected = true;
      return [200, {}];
    });
    await pick("Amazon S3 or compatible");
    expect(screen.getByLabelText(/^Server endpoint/)).toHaveValue("s3.amazonaws.com");

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findAllByText("Required")).toHaveLength(3);
    expect(posted("/repo/exists")).toHaveLength(0);

    await userEvent.type(screen.getByLabelText(/^Bucket/), "my-backups");
    await userEvent.type(screen.getByLabelText(/^Access key ID/), "AKIA");
    await userEvent.type(screen.getByLabelText(/^Secret access key/), "s3cr3t");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("my-backups")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Repository password/), "pw");
    await userEvent.type(screen.getByLabelText(/^Confirm password/), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Create repository" }));

    await waitFor(() => expect(posted("/repo/create")).toHaveLength(1));
    expect(posted("/repo/create")[0].storage).toEqual({
      type: "s3",
      config: {
        bucket: "my-backups",
        endpoint: "s3.amazonaws.com",
        accessKeyID: "AKIA",
        secretAccessKey: "s3cr3t",
        doNotUseTLS: false,
        doNotVerifyTLS: false,
      },
    });
  });

  test("token: connects without a password field", async () => {
    mock.onPost("/repo/connect").reply(() => {
      connected = true;
      return [200, {}];
    });
    await pick("Repository token");
    await userEvent.type(screen.getByLabelText(/^Token/), "abc123");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Connect with a token")).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(posted("/repo/connect")).toHaveLength(1));
    const req = posted("/repo/connect")[0];
    expect(req.token).toBe("abc123");
    expect(req.storage).toBeUndefined();
    expect(mock.history.post.some((r) => r.url === "/repo/exists")).toBe(false);
  });

  test("Kopia server: connects with apiServer and the server password", async () => {
    mock.onPost("/repo/connect").reply(() => {
      connected = true;
      return [200, {}];
    });
    await pick("Kopia repository server");
    await userEvent.type(screen.getByLabelText(/^Server address/), "https://kopia.lan:51515");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.type(await screen.findByLabelText(/^Server password/), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => expect(posted("/repo/connect")).toHaveLength(1));
    expect(posted("/repo/connect")[0]).toMatchObject({ apiServer: { url: "https://kopia.lan:51515" }, password: "pw" });
  });
});

describe("storage settings", () => {
  test("SFTP needs exactly one way to log in and to check the host, unless the external ssh is used", () => {
    const sftp = storageType("sftp");
    const base = { host: "nas", port: 22, username: "me", path: "/kopia" };
    expect(validateConfig(sftp, base)).toMatch(/exactly one of password/);
    expect(validateConfig(sftp, { ...base, password: "x", keyfile: "/k" })).toMatch(/exactly one of password/);
    expect(validateConfig(sftp, { ...base, password: "x" })).toMatch(/known_hosts/);
    expect(validateConfig(sftp, { ...base, password: "x", knownHostsFile: "/kh" })).toBeNull();
    expect(validateConfig(sftp, { ...base, externalSSH: true })).toBeNull();
  });

  test("cleanConfig drops empty and hidden fields and trims text", () => {
    const sftp = storageType("sftp");
    expect(
      cleanConfig(sftp, {
        host: " nas ",
        port: 22,
        username: "me",
        path: "/k",
        password: "",
        externalSSH: true,
        keyfile: "/hidden",
        sshCommand: "ssh",
      }),
    ).toEqual({
      host: "nas",
      port: 22,
      username: "me",
      path: "/k",
      externalSSH: true,
      sshCommand: "ssh",
    });
  });

  test("summaries describe the location", () => {
    expect(storageType("b2").summary({ bucket: "b", prefix: "/kopia" })).toBe("b/kopia");
    expect(storageType("azureBlob").summary({ storageAccount: "acc", container: "c" })).toBe("c");
    expect(storageType("sftp").summary({ username: "me", host: "nas", port: 2222, path: "/k" })).toBe("me@nas:/k");
    expect(storageType("rclone").summary({ remotePath: "gdrive:kopia" })).toBe("gdrive:kopia");
  });

  test("GCS credentials JSON is checked and sent as an object", () => {
    const gcs = storageType("gcs");
    expect(validateConfig(gcs, { bucket: "b", credentials: "{nope" })).toMatch(/not valid JSON/);
    expect(cleanConfig(gcs, { bucket: "b", credentials: '{"type":"service_account"}' })).toEqual({
      bucket: "b",
      credentials: { type: "service_account" },
    });
  });
});
