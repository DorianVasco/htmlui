import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { Route, Routes } from "react-router";
import { apiClient } from "../../src/api";
import { DashboardPage } from "../../src/app/pages/DashboardPage";
import { AppLayout, RequireConnection } from "../../src/app/AppLayout";
import { RepoStatusProvider } from "../../src/app/repoStatus";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

// Shapes as used by tests/pages/Snapshots.test.jsx (written against the real API).
const sourcesResponse = (multiUser = false) => ({
  localUsername: "testuser",
  localHost: "testhost",
  multiUser,
  sources: [
    {
      source: { path: "/home/user/documents", host: "testhost", userName: "testuser" },
      status: "IDLE",
      lastSnapshot: {
        startTime: "2023-01-01T10:00:00Z",
        stats: { totalSize: 1024000 },
        rootEntry: { summ: { files: 100, dirs: 10, numFailed: 1 } },
      },
      nextSnapshotTime: "2099-01-02T10:00:00Z",
    },
    {
      source: { path: "/home/user/photos", host: "testhost", userName: "testuser" },
      status: "UPLOADING",
      upload: {
        hashedFiles: 50,
        hashedBytes: 512000,
        cachedFiles: 20,
        cachedBytes: 204800,
        estimatedBytes: 1024000,
        directory: "/home/user/photos",
      },
      currentTask: "task123",
      lastSnapshot: null,
      nextSnapshotTime: null,
    },
    ...(multiUser
      ? [
          {
            source: { path: "/srv", host: "nas", userName: "root" },
            status: "IDLE",
            lastSnapshot: null,
            nextSnapshotTime: null,
          },
        ]
      : []),
  ],
});

let mock: MockAdapter;

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mock.onGet("/ui-preferences").reply(200, {});
});
afterEach(() => mock.restore());

const renderDashboard = () => renderWithMantine(<DashboardPage />);

describe("DashboardPage", () => {
  test("lists sources with status, progress and errors", async () => {
    mock.onGet("/sources").reply(200, sourcesResponse());
    renderDashboard();

    expect((await screen.findAllByText("/home/user/documents")).length).toBeGreaterThan(0);
    const rows = screen.getAllByTestId("source-row");
    expect(rows).toHaveLength(2);

    const photos = rows.find((r) => r.textContent?.includes("/home/user/photos")) as HTMLElement;
    expect(within(photos).getByText("Uploading 70%")).toBeInTheDocument();
    expect(within(photos).getByRole("button", { name: "Stop snapshot" })).toBeInTheDocument();

    const docs = rows.find((r) => r.textContent?.includes("/home/user/documents")) as HTMLElement;
    expect(within(docs).getByText("1 error")).toBeInTheDocument();
    expect(within(docs).getByText("/home/user/documents").closest("a")).toHaveAttribute(
      "href",
      "/snapshots/single-source?userName=testuser&host=testhost&path=%2Fhome%2Fuser%2Fdocuments",
    );
  });

  test("Snapshot now posts to sources/upload and refreshes the list", async () => {
    mock.onGet("/sources").reply(200, sourcesResponse());
    mock.onPost(/^\/sources\/upload/).reply(200, {});
    renderDashboard();

    const docs = (await screen.findAllByTestId("source-row")).find((r) =>
      r.textContent?.includes("/home/user/documents"),
    ) as HTMLElement;
    const getsBefore = mock.history.get.filter((r) => r.url === "/sources").length;
    await userEvent.click(within(docs).getByRole("button", { name: "Snapshot now" }));

    await waitFor(() => {
      expect(mock.history.post.map((r) => r.url)).toContain(
        "/sources/upload?userName=testuser&host=testhost&path=%2Fhome%2Fuser%2Fdocuments",
      );
      expect(mock.history.get.filter((r) => r.url === "/sources").length).toBeGreaterThan(getsBefore);
    });
  });

  test("Synchronize posts to repo/sync", async () => {
    mock.onGet("/sources").reply(200, sourcesResponse());
    mock.onPost("/repo/sync").reply(200, {});
    renderDashboard();

    await userEvent.click(await screen.findByRole("button", { name: "Synchronize" }));
    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toContain("/repo/sync"));
  });

  test("hides the owner filter unless the server is multi-user", async () => {
    mock.onGet("/sources").reply(200, sourcesResponse(false));
    const { unmount } = renderDashboard();
    await screen.findAllByText("/home/user/documents");
    expect(document.querySelector("input[aria-label=Owner]")).toBeNull();
    unmount();

    mock.onGet("/sources").reply(200, sourcesResponse(true));
    renderDashboard();
    await screen.findAllByText("/home/user/documents");
    expect(document.querySelector("input[aria-label=Owner]")).not.toBeNull();
    // Defaults to this computer's sources only.
    expect(screen.queryByText("/srv")).not.toBeInTheDocument();
  });

  test("filters by path", async () => {
    mock.onGet("/sources").reply(200, sourcesResponse());
    renderDashboard();
    await screen.findAllByText("/home/user/documents");
    await userEvent.type(screen.getByRole("textbox", { name: "Filter sources" }), "photo");
    expect(screen.getAllByTestId("source-row")).toHaveLength(1);
  });

  test("shows an error when sources cannot be loaded", async () => {
    mock.onGet("/sources").reply(500, { error: "storage unavailable" });
    renderDashboard();
    expect(await screen.findByText("storage unavailable")).toBeInTheDocument();
  });

  test("shows an empty state", async () => {
    mock.onGet("/sources").reply(200, { localUsername: "u", localHost: "h", multiUser: false, sources: [] });
    renderDashboard();
    expect(await screen.findByText("Nothing is backed up yet.")).toBeInTheDocument();
  });
});

describe("AppLayout connection gate", () => {
  const renderApp = () =>
    renderWithMantine(
      <RepoStatusProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route element={<RequireConnection />}>
              <Route path="/snapshots" element={<p>dashboard content</p>} />
            </Route>
          </Route>
        </Routes>
      </RepoStatusProvider>,
      { route: "/snapshots" },
    );

  test("shows the not-connected view with a link to repository setup", async () => {
    mock.onGet("/repo/status").reply(200, { connected: false });
    renderApp();
    expect(await screen.findByText("Not connected to a repository")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Set up repository/ })).toHaveAttribute("href", "/repo");
    expect(screen.queryByText("dashboard content")).not.toBeInTheDocument();
  });

  test("renders the page when connected", async () => {
    mock.onGet("/repo/status").reply(200, { connected: true, description: "My repo" });
    mock.onGet("/tasks-summary").reply(200, { RUNNING: 2 });
    renderApp();
    expect(await screen.findByText("dashboard content")).toBeInTheDocument();
    expect(screen.getByText("My repo")).toBeInTheDocument();
    expect(await screen.findByText("2 running")).toBeInTheDocument();
  });

  test("shows an error when the server is unreachable", async () => {
    mock.onGet("/repo/status").networkError();
    renderApp();
    expect(await screen.findByText("Cannot reach the Kopia server")).toBeInTheDocument();
  });
});
