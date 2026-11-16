// Policy editor for one target, shown in a drawer. Edits the policy definition
// (what this policy sets); everything left empty is inherited. The effective
// result and upcoming snapshot times are previewed live via policy/resolve.
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Center,
  Code,
  Divider,
  Drawer,
  Group,
  Loader,
  Modal,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCalendarTime,
  IconFileText,
  IconFileZip,
  IconFilter,
  IconHistory,
  IconSettings,
  IconTerminal2,
  IconUpload,
} from "@tabler/icons-react";
import { api, ApiError, useApi } from "../../../api";
import type { PolicyTarget, ResolvedPolicy } from "../../../api";
import { absoluteTime, relativeTime } from "../../format";
import {
  BooleanField,
  FlagField,
  LinesField,
  NumberField,
  PolicyEditorContext,
  SelectField,
  TagsField,
  TextField,
  TimesOfDayField,
} from "./PolicyFields";
import { cleanPolicy, KIND_INFO, Policy, policyKind, setPath, targetLabel } from "./policyModel";
import { CliEquivalent, cliPolicyTarget } from "../../cli";

const INTERVALS = [
  [600, "every 10 minutes"],
  [900, "every 15 minutes"],
  [1200, "every 20 minutes"],
  [1800, "every 30 minutes"],
  [3600, "every hour"],
  [10800, "every 3 hours"],
  [21600, "every 6 hours"],
  [43200, "every 12 hours"],
  [86400, "every 24 hours"],
] as const;

export const formatInterval = (v: unknown) =>
  INTERVALS.find(([s]) => s === v)?.[1] ?? `every ${Number(v) / 60} minutes`;

const LOG_LEVELS = [
  { value: "0", label: "0 – no output" },
  { value: "1", label: "1 – minimal" },
  ...[2, 3, 4].map((n) => ({ value: String(n), label: String(n) })),
  { value: "5", label: "5 – normal" },
  ...[6, 7, 8, 9].map((n) => ({ value: String(n), label: String(n) })),
  { value: "10", label: "10 – maximum" },
];

const ACTION_MODES = [
  { value: "essential", label: "Must succeed" },
  { value: "optional", label: "Ignore failures" },
  { value: "async", label: "Run in background, ignore failures" },
];

/** Loads the policy definition; a missing policy is a new, empty one. */
async function loadPolicy(target: PolicyTarget, signal: AbortSignal): Promise<{ policy: Policy; isNew: boolean }> {
  try {
    return { policy: await api.policies.get(target, { signal }), isNew: false };
  } catch (err) {
    if (err instanceof ApiError && err.code === "NOT_FOUND") return { policy: {}, isNew: true };
    throw err;
  }
}

function ActionFields({ name, label }: { name: string; label: string }) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        {label}
      </Text>
      <TextField path={`actions.${name}.script`} label="Script" placeholder="command or path to a script" />
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
        <NumberField path={`actions.${name}.timeout`} label="Timeout (seconds)" placeholder="300" />
        <SelectField path={`actions.${name}.mode`} label="Mode" data={ACTION_MODES} />
      </SimpleGrid>
    </Stack>
  );
}

function UpcomingSnapshots({ resolved }: { resolved: ResolvedPolicy | null }) {
  if (!resolved) return null;
  return (
    <Stack gap={4} p="sm" bg="var(--mantine-color-default-hover)" style={{ borderRadius: "var(--mantine-radius-sm)" }}>
      <Text size="xs" fw={600}>
        Upcoming snapshots
      </Text>
      {resolved.schedulingError ? (
        <Text size="xs" c="red">
          {resolved.schedulingError}
        </Text>
      ) : resolved.upcomingSnapshotTimes?.length ? (
        <Text size="xs" c="dimmed" data-testid="upcoming-snapshots">
          {resolved.upcomingSnapshotTimes.map((t) => `${absoluteTime(t)} (${relativeTime(t)})`).join(" · ")}
        </Text>
      ) : (
        <Text size="xs" c="dimmed">
          None scheduled.
        </Text>
      )}
    </Stack>
  );
}

function EditorForm({
  target,
  initial,
  isNew,
  onClose,
  onChanged,
}: {
  target: PolicyTarget;
  initial: Policy;
  isNew: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [policy, setPolicy] = useState<Policy>(initial);
  const [resolved, setResolved] = useState<ResolvedPolicy | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const kind = policyKind(target);
  const dirty = JSON.stringify(cleanPolicy(policy)) !== JSON.stringify(cleanPolicy(initial));

  // Preview the effective policy, debounced while typing.
  const key = JSON.stringify(policy);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api.policies
        .resolve(target, cleanPolicy(JSON.parse(key)), 5, { signal: controller.signal })
        .then((r) => {
          setResolved(r);
          setResolveError(null);
        })
        .catch((err) => {
          if (!controller.signal.aborted) setResolveError(err instanceof Error ? err.message : String(err));
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, target]);

  const ctx = useMemo(
    () => ({
      policy,
      resolved,
      target,
      setField: (path: string, value: unknown) => setPolicy((p) => setPath(p, path, value)),
    }),
    [policy, resolved, target],
  );

  const save = async () => {
    setBusy("save");
    try {
      await api.policies.save(target, cleanPolicy(policy));
      notifications.show({ color: "green", message: `Saved policy for ${targetLabel(target)}.` });
      onChanged();
      onClose();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Could not save policy",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    try {
      await api.policies.delete(target);
      notifications.show({ color: "green", message: `Deleted policy for ${targetLabel(target)}.` });
      onChanged();
      onClose();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Could not delete policy",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
      setConfirmDelete(false);
    }
  };

  return (
    <PolicyEditorContext value={ctx}>
      <Stack h="100%" gap="sm">
        <Stack gap={4}>
          <Group gap="xs">
            <Badge variant="light" color={KIND_INFO[kind].color}>
              {KIND_INFO[kind].label}
            </Badge>
            {isNew && (
              <Badge variant="outline" color="gray">
                New
              </Badge>
            )}
          </Group>
          <Title order={4} style={{ wordBreak: "break-all" }}>
            {targetLabel(target)}
          </Title>
          {kind === "directory" && (
            <Text size="xs" c="dimmed">
              {target.userName}@{target.host}
            </Text>
          )}
          <Text size="xs" c="dimmed">
            Empty fields are inherited from broader policies. Under each field you see the value in effect and where it
            comes from.
          </Text>
          {resolveError && (
            <Alert color="yellow" icon={<IconAlertTriangle />} p="xs">
              Could not preview the effective policy: {resolveError}
            </Alert>
          )}
        </Stack>

        <Tabs
          defaultValue="scheduling"
          keepMounted={false}
          style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
        >
          <ScrollArea type="auto" scrollbarSize={6} offsetScrollbars="x">
            <Tabs.List style={{ flexWrap: "nowrap" }}>
              <Tabs.Tab value="scheduling" leftSection={<IconCalendarTime size={16} />}>
                Schedule
              </Tabs.Tab>
              <Tabs.Tab value="retention" leftSection={<IconHistory size={16} />}>
                Retention
              </Tabs.Tab>
              <Tabs.Tab value="files" leftSection={<IconFilter size={16} />}>
                Files
              </Tabs.Tab>
              <Tabs.Tab value="errors" leftSection={<IconAlertTriangle size={16} />}>
                Errors
              </Tabs.Tab>
              <Tabs.Tab value="compression" leftSection={<IconFileZip size={16} />}>
                Compression
              </Tabs.Tab>
              <Tabs.Tab value="upload" leftSection={<IconUpload size={16} />}>
                Upload
              </Tabs.Tab>
              <Tabs.Tab value="actions" leftSection={<IconTerminal2 size={16} />}>
                Actions
              </Tabs.Tab>
              <Tabs.Tab value="logging" leftSection={<IconFileText size={16} />}>
                Logging
              </Tabs.Tab>
              <Tabs.Tab value="other" leftSection={<IconSettings size={16} />}>
                Other
              </Tabs.Tab>
            </Tabs.List>
          </ScrollArea>

          <ScrollArea type="auto" style={{ flex: 1 }} pt="md" pr="xs">
            <Tabs.Panel value="scheduling">
              <Stack>
                <SelectField
                  path="scheduling.intervalSeconds"
                  label="Snapshot every"
                  help="Only applies while KopiaUI or the Kopia server runs."
                  data={INTERVALS.map(([s, l]) => ({ value: String(s), label: l }))}
                  numeric
                  format={formatInterval}
                />
                <TimesOfDayField
                  path="scheduling.timeOfDay"
                  label="At times of day"
                  help="24-hour format. Press Enter after each time."
                />
                <LinesField
                  path="scheduling.cron"
                  label="Cron expressions"
                  help="One per line: minute hour day month weekday."
                  placeholder="0 2 * * 1-5   # weekdays at 2:00"
                />
                <BooleanField
                  path="scheduling.runMissed"
                  label="Run missed snapshots on startup"
                  help="For time-of-day schedules."
                />
                <BooleanField
                  path="scheduling.manual"
                  label="Manual snapshots only"
                  help="Turns off all scheduled snapshots."
                />
                <UpcomingSnapshots resolved={resolved} />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="retention">
              <Stack>
                <Text size="xs" c="dimmed">
                  How many snapshots to keep per folder. For each period, the latest snapshot in it is kept.
                </Text>
                <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                  <NumberField path="retention.keepLatest" label="Latest" />
                  <NumberField path="retention.keepHourly" label="Hourly" />
                  <NumberField path="retention.keepDaily" label="Daily" />
                  <NumberField path="retention.keepWeekly" label="Weekly" />
                  <NumberField path="retention.keepMonthly" label="Monthly" />
                  <NumberField path="retention.keepAnnual" label="Annual" />
                </SimpleGrid>
                <BooleanField
                  path="retention.ignoreIdenticalSnapshots"
                  label="Skip identical snapshots"
                  help="Don't keep a new snapshot when no files changed."
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="files">
              <Stack>
                <LinesField
                  path="files.ignore"
                  label="Ignore"
                  help={
                    <>
                      One rule per line, like .gitignore (
                      <a href="https://kopia.io/docs/advanced/kopiaignore/" target="_blank" rel="noreferrer">
                        syntax
                      </a>
                      ).
                    </>
                  }
                  placeholder={"node_modules/\n*.tmp"}
                />
                <FlagField path="files.noParentIgnore" label="Don't use ignore rules of parent policies" />
                <TagsField
                  path="files.ignoreDotFiles"
                  label="Ignore rule files"
                  help="Files in a folder that add ignore rules for it."
                  placeholder="e.g. .kopiaignore"
                />
                <FlagField path="files.noParentDotFiles" label="Don't use ignore rule files of parent policies" />
                <BooleanField
                  path="files.ignoreCacheDirs"
                  label="Ignore cache folders"
                  help="Folders marked with CACHEDIR.TAG and similar."
                />
                <NumberField path="files.maxFileSize" label="Ignore files larger than" bytes />
                <BooleanField
                  path="files.oneFileSystem"
                  label="Stay on one file system"
                  help="Don't follow into other drives or mounts."
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="errors">
              <Stack>
                <BooleanField
                  path="errorHandling.ignoreDirectoryErrors"
                  label="Ignore folder read errors"
                  help="Treat them as warnings instead of failing."
                />
                <BooleanField
                  path="errorHandling.ignoreFileErrors"
                  label="Ignore file read errors"
                  help="Treat them as warnings instead of failing."
                />
                <BooleanField
                  path="errorHandling.ignoreUnknownTypes"
                  label="Ignore unknown entry types"
                  help="E.g. sockets or devices."
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="compression">
              <CompressionFields />
            </Tabs.Panel>

            <Tabs.Panel value="upload">
              <Stack>
                <NumberField
                  path="upload.maxParallelSnapshots"
                  label="Parallel snapshots"
                  help={
                    kind === "directory"
                      ? "Can only be set in global, computer or user policies."
                      : "How many snapshots may upload at the same time."
                  }
                  disabled={kind === "directory"}
                />
                <NumberField
                  path="upload.maxParallelFileReads"
                  label="Parallel file reads"
                  help="Defaults to the number of processor cores."
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="actions">
              <Stack>
                <Text size="xs" c="dimmed">
                  Commands to run around snapshots, e.g. to stop a database or create a file system snapshot.
                </Text>
                <ActionFields name="beforeSnapshotRoot" label="Before snapshot" />
                <ActionFields name="afterSnapshotRoot" label="After snapshot" />
                <Divider />
                <ActionFields name="beforeFolder" label="Before each folder" />
                <ActionFields name="afterFolder" label="After each folder" />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="logging">
              <Stack>
                <Text size="xs" c="dimmed">
                  How much detail snapshot logs contain.
                </Text>
                <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                  <SelectField
                    path="logging.directories.snapshotted"
                    label="Folder backed up"
                    data={LOG_LEVELS}
                    numeric
                  />
                  <SelectField path="logging.directories.ignored" label="Folder ignored" data={LOG_LEVELS} numeric />
                  <SelectField path="logging.entries.snapshotted" label="File backed up" data={LOG_LEVELS} numeric />
                  <SelectField path="logging.entries.ignored" label="File ignored" data={LOG_LEVELS} numeric />
                  <SelectField
                    path="logging.entries.cacheHit"
                    label="Unchanged file (cache hit)"
                    data={LOG_LEVELS}
                    numeric
                  />
                  <SelectField
                    path="logging.entries.cacheMiss"
                    label="Changed file (cache miss)"
                    data={LOG_LEVELS}
                    numeric
                  />
                </SimpleGrid>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="other">
              <Stack>
                <FlagField
                  path="noParent"
                  label="Don't inherit from broader policies"
                  help="This folder and its subfolders ignore global, computer and user policies."
                />
                <Stack gap={4}>
                  <Text size="sm" fw={500}>
                    JSON
                  </Text>
                  <Code block fz="xs">
                    {JSON.stringify(cleanPolicy(policy), null, 2)}
                  </Code>
                </Stack>
              </Stack>
            </Tabs.Panel>
          </ScrollArea>
        </Tabs>

        <CliEquivalent command={`policy show ${cliPolicyTarget(target)}`} />
        <Group justify="space-between" pt="sm" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
          {!isNew && kind !== "global" ? (
            <Button variant="subtle" color="red" onClick={() => setConfirmDelete(true)} disabled={!!busy}>
              Delete policy
            </Button>
          ) : (
            <span />
          )}
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={busy === "save"} disabled={!isNew && !dirty}>
              {isNew ? "Create policy" : "Save"}
            </Button>
          </Group>
        </Group>
      </Stack>

      <Modal opened={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete policy?" centered>
        <Stack>
          <Text size="sm">
            The policy for {targetLabel(target)} is removed. Its settings then come from broader policies again.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button color="red" loading={busy === "delete"} onClick={() => void remove()}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PolicyEditorContext>
  );
}

function CompressionFields() {
  const algorithms = useApi((signal) => api.repo.algorithms({ signal }), []);
  const options = [
    { value: "none", label: "none" },
    ...(algorithms.data?.compression ?? [])
      .filter((a) => a.id !== "none")
      .map((a) => ({ value: a.id, label: a.id + (a.deprecated ? " (deprecated)" : "") })),
  ];
  return (
    <Stack>
      <SelectField path="compression.compressorName" label="Algorithm" data={options} />
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
        <NumberField path="compression.minSize" label="Only files larger than" bytes />
        <NumberField path="compression.maxSize" label="Only files smaller than" bytes />
      </SimpleGrid>
      <TagsField path="compression.onlyCompress" label="Only compress extensions" placeholder="e.g. .txt" />
      <TagsField path="compression.neverCompress" label="Never compress extensions" placeholder="e.g. .mp4" />
    </Stack>
  );
}

export function PolicyEditorDrawer({
  target,
  onClose,
  onChanged,
}: {
  target: PolicyTarget | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <Drawer
      opened={!!target}
      onClose={onClose}
      position="right"
      size="xl"
      title="Policy"
      styles={{ body: { height: "calc(100% - 60px)" } }}
    >
      {target && <EditorLoader key={JSON.stringify(target)} target={target} onClose={onClose} onChanged={onChanged} />}
    </Drawer>
  );
}

function EditorLoader({
  target,
  onClose,
  onChanged,
}: {
  target: PolicyTarget;
  onClose: () => void;
  onChanged: () => void;
}) {
  const loaded = useApi((signal) => loadPolicy(target, signal), [target.userName, target.host, target.path]);
  if (loaded.data)
    return (
      <EditorForm
        target={target}
        initial={loaded.data.policy}
        isNew={loaded.data.isNew}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  if (loaded.error)
    return (
      <Alert color="red" title="Could not load policy">
        {loaded.error.message}
      </Alert>
    );
  return (
    <Center py="xl">
      <Loader />
    </Center>
  );
}
