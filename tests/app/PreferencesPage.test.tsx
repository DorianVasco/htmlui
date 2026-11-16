import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { apiClient } from "../../src/api";
import { AppRoutes } from "../../src/app/App";
import { resetKnownReposCache } from "../../src/app/knownRepos";
import { PreferencesProvider } from "../../src/app/preferences";
import { missingFields, newProfileName } from "../../src/app/pages/preferences/NotificationProfiles";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

const EMAIL = {
  profile: "email-1",
  method: { type: "email", config: { smtpServer: "smtp.x", smtpPort: 587, from: "a@x", to: "b@x" } },
  minSeverity: 10,
};

let mock: MockAdapter;
let stored: Record<string, unknown>;

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  localStorage.clear();
  resetKnownReposCache();
  stored = { bytesStringBase2: false, defaultSnapshotViewAll: false, theme: "ocean", fontSize: "fs-5", pageSize: 50 };
  mock = new MockAdapter(apiClient);
  mock.onGet("/repo/status").reply(200, { connected: true, description: "Repo", storage: "filesystem" });
  mock.onGet("/tasks-summary").reply(200, {});
  mock.onGet("/ui-preferences").reply(() => [200, stored]);
  mock.onPut("/ui-preferences").reply((config) => {
    stored = JSON.parse(config.data);
    return [200, {}];
  });
  mock.onGet("/notificationProfiles").reply(200, [EMAIL]);
});
afterEach(() => mock.restore());

const renderPage = () =>
  renderWithMantine(
    <PreferencesProvider>
      <AppRoutes />
    </PreferencesProvider>,
    { route: "/preferences" },
  );

describe("PreferencesPage", () => {
  test("saves the byte setting and keeps the old UI's fields", async () => {
    renderPage();
    const option = await screen.findByRole("radio", { name: "1 KiB = 1024 bytes" });
    await waitFor(() => expect(option).toBeEnabled());
    await userEvent.click(option);
    await waitFor(() => expect(stored.bytesStringBase2).toBe(true));
    expect(stored).toMatchObject({ theme: "ocean", fontSize: "fs-5", pageSize: 50 });
  });

  test("lists notification profiles", async () => {
    renderPage();
    const row = await screen.findByTestId("notification-profile");
    expect(row).toHaveTextContent("email-1");
    expect(row).toHaveTextContent("E-mail");
    expect(row).toHaveTextContent("Warning");
  });

  test("creates a webhook profile after validating required fields", async () => {
    mock.onPost("/notificationProfiles").reply(200, {});
    renderPage();
    await screen.findByTestId("notification-profile");
    await userEvent.click(screen.getByRole("button", { name: "Add profile" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Webhook" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Profile name/)).toHaveValue("webhook-1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create profile" }));
    expect(await within(dialog).findByText("Required")).toBeInTheDocument();
    expect(mock.history.post).toHaveLength(0);

    await userEvent.type(within(dialog).getByLabelText(/^URL/), "https://hook.test/x");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create profile" }));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      profile: "webhook-1",
      minSeverity: 0,
      method: { type: "webhook", config: { endpoint: "https://hook.test/x", format: "txt", method: "POST" } },
    });
  });

  test("shows a send failure in the dialog", async () => {
    mock.onPost("/testNotificationProfile").reply(500, { code: "INTERNAL", error: "connection refused" });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Edit email-1" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send test" }));
    expect(await within(dialog).findByText("Sending failed")).toBeInTheDocument();
    expect(within(dialog).getByText(/connection refused/)).toBeInTheDocument();
  });

  test("hides notifications when not connected", async () => {
    mock.onGet("/repo/status").reply(200, { connected: false });
    renderPage();
    expect(await screen.findByText(/Connect to a repository to manage them/)).toBeInTheDocument();
  });
});

describe("notification helpers", () => {
  test("picks the first free profile name", () => {
    expect(newProfileName("email", [EMAIL])).toBe("email-2");
    expect(newProfileName("pushover", [EMAIL])).toBe("pushover-1");
  });

  test("reports missing required fields", () => {
    expect(missingFields({ profile: "p", method: { type: "pushover", config: { appToken: " " } } })).toEqual([
      "appToken",
      "userKey",
    ]);
    expect(missingFields(EMAIL)).toEqual([]);
  });
});
