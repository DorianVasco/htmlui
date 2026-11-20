import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MockAdapter from "axios-mock-adapter";
import { apiClient } from "../../src/api";
import {
  cleanLimits,
  formatRate,
  limitsSummary,
  NetworkLimitsCard,
  rateToBytes,
  splitRate,
} from "../../src/app/pages/repository/NetworkLimits";
import { installMantineDomStubs, renderWithMantine } from "../testutils/mantine";

let mock: MockAdapter;

beforeAll(() => installMantineDomStubs());
beforeEach(() => {
  mock = new MockAdapter(apiClient);
});
afterEach(() => mock.restore());

describe("network limit helpers", () => {
  test("converts between bytes per second and form units", () => {
    expect(splitRate(5e6, false)).toEqual({ amount: 5, unit: "M" });
    expect(splitRate(500e3, false)).toEqual({ amount: 500, unit: "k" });
    expect(splitRate(1048576, true)).toEqual({ amount: 1, unit: "M" });
    expect(splitRate(undefined, false)).toEqual({ amount: "", unit: "M" });
    expect(rateToBytes(2.5, "M", false)).toBe(2500000);
    expect(rateToBytes(512, "k", true)).toBe(524288);
    expect(rateToBytes("", "M", false)).toBeUndefined();
    expect(rateToBytes(0, "M", false)).toBeUndefined();
  });

  test("formats rates and the summary", () => {
    expect(formatRate(1.5e6, false)).toBe("1.5 MB/s");
    expect(formatRate(0, false)).toBe("unlimited");
    expect(limitsSummary({}, false)).toMatch(/No limits/);
    expect(limitsSummary({ maxUploadSpeedBytesPerSecond: 5e6, concurrentReads: 4 }, false)).toBe(
      "Upload 5 MB/s · Download unlimited · 1 more limit",
    );
  });

  test("only positive limits are sent", () => {
    expect(cleanLimits({ readsPerSecond: 0, concurrentWrites: 2, maxUploadSpeedBytesPerSecond: undefined })).toEqual({
      concurrentWrites: 2,
    });
  });
});

describe("NetworkLimitsCard", () => {
  test("shows the current limits and saves new ones", async () => {
    mock.onGet("/repo/throttle").reply(200, { maxUploadSpeedBytesPerSecond: 5e6 });
    mock.onPut("/repo/throttle").reply(200, {});
    renderWithMantine(<NetworkLimitsCard description="NAS" />);

    expect(await screen.findByTestId("network-limits-summary")).toHaveTextContent("Upload 5 MB/s · Download unlimited");
    await userEvent.click(screen.getByRole("button", { name: "Edit…" }));
    const dialog = await screen.findByRole("dialog", { name: "Network limits – NAS" });
    expect(within(dialog).getByLabelText("Upload limit")).toHaveValue("5");

    await userEvent.type(within(dialog).getByLabelText("Download limit"), "20");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({
      maxUploadSpeedBytesPerSecond: 5000000,
      maxDownloadSpeedBytesPerSecond: 20000000,
    });
  });

  test("removing all limits sends an empty object", async () => {
    mock.onGet("/repo/throttle").reply(200, { maxUploadSpeedBytesPerSecond: 5e6, concurrentReads: 2 });
    mock.onPut("/repo/throttle").reply(200, {});
    renderWithMantine(<NetworkLimitsCard />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit…" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove all limits" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({});
  });

  test("explains that repositories on a Kopia server have no limits here", async () => {
    mock.onGet("/repo/throttle").reply(400, { code: "STORAGE_CONNECTION", error: "no direct storage connection" });
    renderWithMantine(<NetworkLimitsCard />);
    expect(await screen.findByText("Not available for repositories on a Kopia server.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit…" })).toBeDisabled();
  });
});
