// Version shown in the sidebar footer. index.html carries a hidden
// <p id="kopia-version">Version …</p>: the build fills in VITE_FULL_VERSION_INFO,
// and the Kopia server inserts its own version ("v0.21.1 <build info>") after
// "Version " when serving the page (see patchIndexBytes in kopia's server.go).

export interface AppVersion {
  /** Short form, e.g. "v0.21.1"; empty when unknown (dev server). */
  short: string;
  /** Everything known, for a tooltip. */
  full: string;
}

export function parseVersionText(text: string | null | undefined): AppVersion {
  const full = (text ?? "")
    .replace(/^\s*Version\s*/, "")
    .replace(/%VITE_FULL_VERSION_INFO%/g, "")
    .replace(/\s+/g, " ")
    .trim()
    // The server prefixes "v" to its version, so "v0.21" can arrive as "vv0.21".
    .replace(/^v(?=v)/, "");
  const short = /^v\d[\w.+-]*/.exec(full)?.[0] ?? "";
  return { short, full };
}

export function readAppVersion(doc: Document = document): AppVersion {
  return parseVersionText(doc.getElementById("kopia-version")?.textContent);
}
