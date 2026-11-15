export type DevMockMode = "connected" | "disconnected" | "empty";

const KEY = "kopia-dev-mock";

/**
 * Reads ?mock=1|disconnected|empty|0 from the URL (remembered for the tab
 * session) and returns the mock mode, or null for the real server.
 */
export function devMockMode(): DevMockMode | null {
  let stored: string | null;
  try {
    const param = new URLSearchParams(window.location.search).get("mock");
    if (param !== null) {
      if (param === "0" || param === "off") sessionStorage.removeItem(KEY);
      else sessionStorage.setItem(KEY, param);
    }
    stored = sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (stored === "disconnected" || stored === "empty") return stored;
  return stored ? "connected" : null;
}
