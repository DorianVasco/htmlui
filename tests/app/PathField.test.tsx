import React from "react";
import { afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { apiClient } from "../../src/api";
import { AppRoutes } from "../../src/app/App";
import { rememberRepo, resetKnownReposCache, setActiveRepo } from "../../src/app/knownRepos";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

let mock: MockAdapter;

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  localStorage.clear();
  resetKnownReposCache();
  mock = new MockAdapter(apiClient);
  mock.onGet("/repo/status").reply(200, { connected: false });
  mock.onGet("/repo/algorithms").reply(200, { hash: [], encryption: [], ecc: [], splitter: [], compression: [] });
  mock.onGet("/current-user").reply(200, { username: "mail", hostname: "bruno" });
  // Mimics the server: "~" and relative paths are resolved against the home folder.
  mock.onPost("/paths/resolve").reply((config) => {
    const p: string = JSON.parse(config.data).path;
    const abs = p === "~" ? "/home/mail" : p.startsWith("~/") ? "/home/mail/" + p.slice(2) : p;
    return [200, { source: { userName: "mail", host: "bruno", path: abs } }];
  });
});
afterEach(() => mock.restore());

async function openLocationStep() {
  renderWithMantine(<AppRoutes />, { route: "/repo" });
  await userEvent.click(await screen.findByRole("button", { name: "Local directory or NAS" }));
  return screen.findByLabelText(/^Directory/, { selector: "input" });
}

test("suggests recently used repositories and common locations", async () => {
  rememberRepo({
    storage: { type: "filesystem", config: { path: "/mnt/nas/kopia" } },
    description: "NAS repo",
    clientOptions: { username: "mail", hostname: "bruno", readonly: false },
  });
  setActiveRepo(null);
  const input = await openLocationStep();

  await userEvent.click(input);
  expect(await screen.findByText("Recently used")).toBeInTheDocument();
  const listbox = screen.getByRole("listbox", { hidden: true });
  expect(within(listbox).getByText("NAS repo")).toBeInTheDocument();
  expect(await within(listbox).findByText("/home/mail/kopia-repository")).toBeInTheDocument();
  expect(within(listbox).getByText("/home/mail")).toBeInTheDocument();

  await userEvent.click(within(listbox).getByText("/mnt/nas/kopia"));
  expect(input).toHaveValue("/mnt/nas/kopia");
});

test("resolves a home-relative path before checking the location", async () => {
  mock.onPost("/repo/exists").reply(400, { code: "NOT_INITIALIZED", error: "not initialized" });
  const input = await openLocationStep();

  await userEvent.type(input, "~/backups");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  expect(await screen.findByText("A new repository will be created")).toBeInTheDocument();
  await waitFor(() => {
    const exists = mock.history.post.find((r) => r.url === "/repo/exists");
    expect(JSON.parse(exists!.data)).toEqual({
      storage: { type: "filesystem", config: { path: "/home/mail/backups" } },
    });
  });
  expect(screen.getByText("/home/mail/backups")).toBeInTheDocument();
});
