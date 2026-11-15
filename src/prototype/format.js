// Small display helpers for the prototype; reuses the existing pure utils.
import { sizeDisplayName, formatDuration } from "../utils/formatutils";

export { sizeDisplayName, formatDuration };

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function relativeTime(isoString) {
  if (!isoString) return "—";
  const diff = new Date(isoString).valueOf() - Date.now();
  const abs = Math.abs(diff);
  const units = [
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function ageInDays(isoString) {
  return (Date.now() - new Date(isoString).valueOf()) / 86400000;
}

export function ownerName(s) {
  return s.userName + "@" + s.host;
}
