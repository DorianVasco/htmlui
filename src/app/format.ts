import { sizeDisplayName } from "../utils/formatutils";

export { sizeDisplayName };

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400000],
  ["month", 30 * 86400000],
  ["day", 86400000],
  ["hour", 3600000],
  ["minute", 60000],
];

/** "3 hours ago", "in 10 minutes", "just now". `now` is injectable for tests. */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "";
  const diff = new Date(iso).valueOf() - now;
  const abs = Math.abs(diff);
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function absoluteTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : "";
}

export function ownerName(s: { userName: string; host: string }): string {
  return s.userName + "@" + s.host;
}
