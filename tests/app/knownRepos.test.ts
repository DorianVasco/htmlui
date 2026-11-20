import { beforeEach, describe, expect, test } from "vitest";
import {
  forgetRepo,
  rememberableStorage,
  rememberRepo,
  resetKnownReposCache,
  updateRepo,
} from "../../src/app/knownRepos";

const opts = { username: "u", hostname: "h", readonly: false };
const list = () => JSON.parse(localStorage.getItem("kopia-known-repositories") ?? "[]");

describe("knownRepos", () => {
  beforeEach(() => {
    localStorage.clear();
    resetKnownReposCache();
  });

  test("only remembers storage without secrets", () => {
    expect(rememberableStorage({ type: "filesystem", config: { path: "/x" } })).toEqual({
      type: "filesystem",
      config: { path: "/x" },
    });
    expect(rememberableStorage({ type: "s3", config: { bucket: "b", secretAccessKey: "s" } })).toBeNull();
    expect(rememberableStorage({ type: "filesystem", config: {} })).toBeNull();
  });

  test("dedupes by location, keeps newest first and tracks the active one", () => {
    rememberRepo({ storage: { type: "filesystem", config: { path: "/a" } }, description: "A", clientOptions: opts });
    rememberRepo({ storage: { type: "filesystem", config: { path: "/b" } }, description: "B", clientOptions: opts });
    rememberRepo({ storage: { type: "filesystem", config: { path: "/a" } }, description: "A2", clientOptions: opts });
    expect(list().map((r: { description: string }) => r.description)).toEqual(["A2", "B"]);
    expect(localStorage.getItem("kopia-active-repository")).toBe("filesystem:/a");

    updateRepo("filesystem:/b", { description: "Bee" });
    expect(list()[1].description).toBe("Bee");

    forgetRepo("filesystem:/a");
    expect(list()).toHaveLength(1);
    expect(localStorage.getItem("kopia-active-repository")).toBeNull();
  });

  test("ignores corrupt storage", () => {
    localStorage.setItem("kopia-known-repositories", "{not json");
    resetKnownReposCache();
    rememberRepo({ storage: { type: "filesystem", config: { path: "/a" } }, description: "A", clientOptions: opts });
    expect(list()).toHaveLength(1);
  });
});
