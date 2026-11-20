import { describe, expect, test } from "vitest";
import { parseVersionText, readAppVersion } from "../../src/app/version";

describe("app version", () => {
  test("dev server: placeholder only, nothing to show", () => {
    expect(parseVersionText("Version %VITE_FULL_VERSION_INFO%")).toEqual({ short: "", full: "" });
  });

  test("build without a Kopia version: build info only, no short version", () => {
    expect(parseVersionText("Version kopia/htmlui abc123 built on Mon")).toEqual({
      short: "",
      full: "kopia/htmlui abc123 built on Mon",
    });
  });

  test("served by Kopia: server version first", () => {
    expect(parseVersionText("Version v0.21.1 4a5b6c  kopia/htmlui abc123")).toEqual({
      short: "v0.21.1",
      full: "v0.21.1 4a5b6c kopia/htmlui abc123",
    });
    // The server prefixes "v" itself, so dev builds arrive as "vv0-unofficial".
    expect(parseVersionText("Version vv0-unofficial  local build").short).toBe("v0-unofficial");
  });

  test("reads the hidden element from index.html", () => {
    document.body.innerHTML = '<div id="kopia-version" hidden><p class="version-info">Version v0.22.0 x</p></div>';
    expect(readAppVersion().short).toBe("v0.22.0");
  });
});
