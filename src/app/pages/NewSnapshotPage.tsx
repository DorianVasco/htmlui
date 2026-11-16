import React, { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Alert, Anchor, Badge, Breadcrumbs, Button, Card, Group, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCalculator,
  IconExternalLink,
  IconInfoCircle,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react";
import { api, ApiError, useApi, useTask } from "../../api";
import type { ResolvedPolicy, SourceInfo, Task } from "../../api";
import { PageHeader } from "../components";
import { ownerName, relativeTime, sizeDisplayName } from "../format";
import { policyEditorPath } from "./policies/policyModel";
import { usePreferences } from "../preferences";
import { PathField } from "../PathField";

/** Suggested folders to back up (home-relative, resolved by the server). */
const SOURCE_LOCATIONS = ["~", "~/Documents", "~/Desktop", "~/Pictures", "~/Music", "~/Videos", "~/Downloads"];

type PolicyDefinition = Record<string, unknown>;

/** The source's own policy definition, or {} when it has none (NOT_FOUND). */
async function loadPolicyDefinition(source: SourceInfo, signal: AbortSignal): Promise<PolicyDefinition> {
  try {
    return await api.policies.get(source, { signal });
  } catch (err) {
    if (err instanceof ApiError && err.code === "NOT_FOUND") return {};
    throw err;
  }
}

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function retentionSummary(effective: Record<string, unknown>): string {
  const r = (effective.retention ?? {}) as Record<string, unknown>;
  const parts: [string, unknown][] = [
    ["latest", r.keepLatest],
    ["hourly", r.keepHourly],
    ["daily", r.keepDaily],
    ["weekly", r.keepWeekly],
    ["monthly", r.keepMonthly],
    ["annual", r.keepAnnual],
  ];
  const kept = parts.filter(([, v]) => num(v)).map(([k, v]) => `${v} ${k}`);
  return kept.length ? kept.join(", ") : "keep everything";
}

function scheduleSummary(effective: Record<string, unknown>): string {
  const s = (effective.scheduling ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  const interval = num(s.intervalSeconds);
  if (interval) {
    parts.push(interval % 3600 === 0 ? `every ${interval / 3600} h` : `every ${Math.round(interval / 60)} min`);
  }
  const times = Array.isArray(s.timeOfDay) ? (s.timeOfDay as { hour: number; min: number }[]) : [];
  if (times.length) {
    parts.push(
      "at " + times.map((t) => `${String(t.hour).padStart(2, "0")}:${String(t.min).padStart(2, "0")}`).join(", "),
    );
  }
  if (typeof s.cron === "string" || (Array.isArray(s.cron) && s.cron.length)) parts.push("cron");
  return parts.length ? parts.join(" ") : "manual only";
}

function compressionSummary(effective: Record<string, unknown>): string {
  const c = (effective.compression ?? {}) as Record<string, unknown>;
  return typeof c.compressorName === "string" && c.compressorName ? c.compressorName : "none";
}

function ignoreSummary(effective: Record<string, unknown>): string {
  const f = (effective.files ?? {}) as Record<string, unknown>;
  const ignore = Array.isArray(f.ignore) ? (f.ignore as string[]) : [];
  return ignore.length ? ignore.join(", ") : "nothing";
}

function PolicyPreview({ resolved, source }: { resolved: ResolvedPolicy; source: SourceInfo }) {
  const e = resolved.effective ?? {};
  const upcoming = resolved.upcomingSnapshotTimes ?? [];
  const rows: [string, string][] = [
    ["Schedule", scheduleSummary(e)],
    ["Keeps", retentionSummary(e)],
    ["Compression", compressionSummary(e)],
    ["Ignores", ignoreSummary(e)],
  ];
  return (
    <Card>
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Policy</Text>
        <Anchor component={Link} to={policyEditorPath(source)} size="sm">
          Edit policy <IconExternalLink size={12} style={{ verticalAlign: "middle" }} />
        </Anchor>
      </Group>
      <Stack gap={6}>
        {rows.map(([k, v]) => (
          <Group key={k} gap="sm" wrap="nowrap" align="flex-start">
            <Text size="sm" c="dimmed" w={100} style={{ flexShrink: 0 }}>
              {k}
            </Text>
            <Text size="sm" style={{ wordBreak: "break-word" }}>
              {v}
            </Text>
          </Group>
        ))}
        {upcoming.length > 0 && (
          <Group gap="sm" wrap="nowrap" align="flex-start">
            <Text size="sm" c="dimmed" w={100} style={{ flexShrink: 0 }}>
              Next runs
            </Text>
            <Text size="sm">{upcoming.map((t) => relativeTime(t)).join(" · ")}</Text>
          </Group>
        )}
      </Stack>
      <Text size="xs" c="dimmed" mt="sm">
        Inherited from the global and host policies unless this folder has its own.
      </Text>
    </Card>
  );
}

function counter(task: Task, name: string): number | undefined {
  return task.counters?.[name]?.value;
}

function EstimateResult({ taskId, onCancel }: { taskId: string; onCancel: () => void }) {
  const { data: task, error } = useTask(taskId);
  const { bytesStringBase2: base2 } = usePreferences();
  if (error && !task) return <Alert color="red">{error.message}</Alert>;
  if (!task) return <Loader size="sm" />;

  const running = task.status === "RUNNING";
  const stats: [string, string, string | undefined][] = [
    [
      "Size",
      sizeDisplayName(counter(task, "Bytes") ?? 0, base2),
      counter(task, "Excluded Bytes")
        ? `${sizeDisplayName(counter(task, "Excluded Bytes"), base2)} excluded`
        : undefined,
    ],
    [
      "Files",
      (counter(task, "Files") ?? 0).toLocaleString(),
      counter(task, "Excluded Files") ? `${counter(task, "Excluded Files")?.toLocaleString()} excluded` : undefined,
    ],
    [
      "Folders",
      (counter(task, "Directories") ?? 0).toLocaleString(),
      counter(task, "Excluded Directories")
        ? `${counter(task, "Excluded Directories")?.toLocaleString()} excluded`
        : undefined,
    ],
    [
      "Errors",
      (counter(task, "Errors") ?? 0).toLocaleString(),
      counter(task, "Ignored Errors") ? `${counter(task, "Ignored Errors")} ignored` : undefined,
    ],
  ];

  return (
    <Stack gap="sm" data-testid="estimate-result">
      <Group justify="space-between">
        <Group gap="xs">
          {running ? <Loader size="xs" /> : null}
          <Text size="sm" fw={600}>
            {running
              ? "Estimating…"
              : task.status === "SUCCESS"
                ? "Estimate"
                : task.status === "CANCELED"
                  ? "Estimate canceled"
                  : "Estimate failed"}
          </Text>
        </Group>
        {running && (
          <Button size="xs" variant="subtle" color="red" leftSection={<IconX size={14} />} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
        {stats.map(([label, value, hint]) => (
          <Stack key={label} gap={0}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {label}
            </Text>
            <Text fw={700}>{value}</Text>
            {hint && (
              <Text size="xs" c="dimmed">
                {hint}
              </Text>
            )}
          </Stack>
        ))}
      </SimpleGrid>
      {task.status === "FAILED" && task.errorMessage && (
        <Text size="sm" c="red">
          {task.errorMessage}
        </Text>
      )}
    </Stack>
  );
}

export function NewSnapshotPage() {
  const navigate = useNavigate();
  const [path, setPath] = useState("");
  const [debouncedPath] = useDebouncedValue(path.trim(), 400);
  const [estimateTask, setEstimateTask] = useState<{ id: string; path: string } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState<"snapshot" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolved = useApi((signal) => api.sources.resolvePath(debouncedPath, { signal }), [debouncedPath], {
    enabled: !!debouncedPath,
  });
  const source = debouncedPath && resolved.data && !resolved.error ? resolved.data.source : undefined;
  const sourceKey = source ? ownerName(source) + ":" + source.path : "";

  const policyDef = useApi((signal) => loadPolicyDefinition(source as SourceInfo, signal), [sourceKey], {
    enabled: !!source,
  });
  const preview = useApi(
    (signal) => api.policies.resolve(source as SourceInfo, policyDef.data ?? {}, 3, { signal }),
    [sourceKey, policyDef.data],
    {
      enabled: !!source && !!policyDef.data,
    },
  );
  const existing = useApi((signal) => api.sources.list({ signal }), [sourceKey], { enabled: !!source });
  const alreadyBackedUp =
    !!source &&
    !!existing.data?.sources.some((s) => ownerName(s.source) === ownerName(source) && s.source.path === source.path);

  const pathChanging = path.trim() !== debouncedPath || (!!debouncedPath && resolved.isLoading);
  const ready = !!source && !pathChanging && !!policyDef.data;

  const startEstimate = async () => {
    if (!source) return;
    setEstimating(true);
    setError(null);
    try {
      const task = await api.sources.estimate({
        root: source.path,
        maxExamplesPerBucket: 10,
        policyOverride: policyDef.data ?? {},
      });
      setEstimateTask({ id: task.id, path: source.path });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEstimating(false);
    }
  };

  const create = async (snapshotNow: boolean) => {
    if (!source || !policyDef.data) return;
    setSubmitting(snapshotNow ? "snapshot" : "save");
    setError(null);
    try {
      if (alreadyBackedUp) {
        // Don't re-create: that would overwrite the source's policy. Just start a snapshot.
        if (snapshotNow) await api.sources.upload(source);
      } else {
        // The server requires a policy and stores it for the source; send its current definition.
        await api.sources.create({ path: source.path, createSnapshot: snapshotNow, policy: policyDef.data });
      }
      notifications.show({
        color: "green",
        title: snapshotNow ? "Snapshot started" : "Folder added",
        message: source.path,
      });
      navigate("/snapshots");
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === "PATH_NOT_FOUND"
          ? "This folder does not exist on the server's computer."
          : err instanceof Error
            ? err.message
            : String(err);
      setError(msg);
    } finally {
      setSubmitting(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) void create(true);
  };

  const showEstimate = estimateTask && source && estimateTask.path === source.path;

  return (
    <>
      <Breadcrumbs mb="sm" fz="sm">
        <Anchor component={Link} to="/snapshots">
          Snapshots
        </Anchor>
        <Text size="sm" c="dimmed">
          New snapshot
        </Text>
      </Breadcrumbs>
      <PageHeader
        title="New snapshot"
        description="Choose a folder to back up. Kopia keeps snapshotting it according to its policy."
      />

      <Stack maw={860}>
        <Card>
          <form onSubmit={onSubmit}>
            <Stack>
              <PathField
                label="Folder to back up"
                placeholder={
                  navigator.platform.startsWith("Win") ? "e.g. C:\\Users\\me\\Documents" : "e.g. /home/me/Documents"
                }
                value={path}
                onChange={setPath}
                locations={SOURCE_LOCATIONS}
                rightSection={pathChanging && path.trim() ? <Loader size={14} /> : undefined}
                autoFocus
              />

              {source && !pathChanging && (
                <Group gap="xs">
                  <Text size="sm" c="dimmed">
                    Snapshots will be stored as
                  </Text>
                  <Badge variant="light" tt="none" size="lg" radius="sm" data-testid="resolved-source">
                    {ownerName(source)}:{source.path}
                  </Badge>
                </Group>
              )}
              {resolved.error && debouncedPath && !pathChanging && (
                <Text size="sm" c="red">
                  {resolved.error.message}
                </Text>
              )}

              {alreadyBackedUp && (
                <Alert color="blue" icon={<IconInfoCircle />}>
                  This folder is already being backed up. “Snapshot now” starts a new snapshot with its existing policy.
                </Alert>
              )}

              {error && (
                <Alert color="red" icon={<IconAlertTriangle />} title="Something went wrong">
                  {error}
                </Alert>
              )}

              <Group justify="space-between">
                <Button
                  variant="default"
                  leftSection={<IconCalculator size={16} />}
                  disabled={!ready}
                  loading={estimating}
                  onClick={() => void startEstimate()}
                >
                  Estimate size
                </Button>
                <Group gap="xs">
                  {!alreadyBackedUp && (
                    <Button
                      variant="default"
                      disabled={!ready || !!submitting}
                      loading={submitting === "save"}
                      onClick={() => void create(false)}
                    >
                      Add without snapshot
                    </Button>
                  )}
                  <Button
                    type="submit"
                    leftSection={<IconPlayerPlay size={16} />}
                    disabled={!ready || !!submitting}
                    loading={submitting === "snapshot"}
                  >
                    Snapshot now
                  </Button>
                </Group>
              </Group>

              {showEstimate && (
                <Card withBorder bg="var(--mantine-color-default-hover)" padding="md">
                  <EstimateResult taskId={estimateTask.id} onCancel={() => void api.tasks.cancel(estimateTask.id)} />
                </Card>
              )}
            </Stack>
          </form>
        </Card>

        {source && !pathChanging && preview.data && <PolicyPreview resolved={preview.data} source={source} />}
        {policyDef.error && <Alert color="red">{policyDef.error.message}</Alert>}
      </Stack>
    </>
  );
}
