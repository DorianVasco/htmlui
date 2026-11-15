// Shared presentation helpers for tasks: status badge, counters and log levels.
import React from "react";
import { Badge, Loader } from "@mantine/core";
import { IconBan, IconCheck, IconX } from "@tabler/icons-react";
import type { Task } from "../../../api";
import { sizeDisplayName } from "../../format";

export const isRunning = (t: Task) => t.status === "RUNNING" || t.status === "CANCELING";

export function TaskStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "RUNNING":
      return (
        <Badge variant="light" color="blue" leftSection={<Loader size={10} color="blue" />}>
          Running
        </Badge>
      );
    case "CANCELING":
      return (
        <Badge variant="light" color="yellow" leftSection={<Loader size={10} color="yellow" />}>
          Canceling
        </Badge>
      );
    case "SUCCESS":
      return (
        <Badge variant="light" color="green" leftSection={<IconCheck size={12} />}>
          Success
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="light" color="red" leftSection={<IconX size={12} />}>
          Failed
        </Badge>
      );
    case "CANCELED":
      return (
        <Badge variant="light" color="gray" leftSection={<IconBan size={12} />}>
          Canceled
        </Badge>
      );
    default:
      return (
        <Badge variant="light" color="gray">
          {status}
        </Badge>
      );
  }
}

const LEVEL_ORDER: Record<string, number> = { error: 3, warning: 2, notice: 1 };

export interface CounterRow {
  label: string;
  value: string;
  level: string;
}

/** Non-zero counters, most important level first, then by name. Byte counters are formatted. */
export function counterRows(counters: Task["counters"], base2 = false): CounterRow[] {
  return Object.entries(counters ?? {})
    .filter(([, c]) => (c?.value ?? 0) > 0)
    .sort(
      ([a, ca], [b, cb]) =>
        (LEVEL_ORDER[cb.level ?? ""] ?? 0) - (LEVEL_ORDER[ca.level ?? ""] ?? 0) || a.localeCompare(b),
    )
    .map(([label, c]) => ({
      label,
      value: c.units === "bytes" ? sizeDisplayName(c.value, base2) : c.value.toLocaleString(),
      level: c.level ?? "",
    }));
}

/** Log entry levels as used by the server: 0 info, 1 notice, 2 warning, 3 error. */
export function logLevelColor(level: number): string | undefined {
  if (level >= 3) return "red";
  if (level === 2) return "orange";
  return undefined;
}

/** "12:04:11.123" */
export function logTime(ts: number): string {
  const d = new Date(ts * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/** Extra structured fields of a log entry (beyond msg/ts/level/mod) as compact JSON, or "". */
export function logParams(entry: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { msg, ts, level, mod, ...rest } = entry;
  return Object.keys(rest).length ? JSON.stringify(rest) : "";
}
