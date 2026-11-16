import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Menu,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArchive,
  IconClockPlay,
  IconDatabase,
  IconDots,
  IconFolder,
  IconHistory,
  IconListDetails,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
} from "@tabler/icons-react";
import { api, useSources } from "../../api";
import type { SourceInfo, SourceStatus } from "../../api";
import { PageHeader, StatCard } from "../components";
import { absoluteTime, ownerName, relativeTime, sizeDisplayName } from "../format";
import { policyEditorPath } from "./policies/policyModel";
import { sourceDetailPath } from "./source/SourceDetailPage";
import { usePreferences } from "../preferences";
import {
  ALL_OWNERS,
  failedCount,
  failureDetails,
  filterByOwner,
  isActive,
  isOverdue,
  LOCAL_OWNER,
  needsAttention,
  nextScheduled,
  sourceState,
  totalSize,
  uploadProgress,
} from "../sourceStatus";

const sourceKey = (s: SourceInfo) => ownerName(s) + ":" + s.path;

/** Current time, refreshed periodically so relative times stay current between polls. */
function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function showError(title: string, err: unknown) {
  notifications.show({ color: "red", title, message: err instanceof Error ? err.message : String(err) });
}

function StatusCell({ s, base2, now }: { s: SourceStatus; base2: boolean; now: number }) {
  const state = sourceState(s, now);
  switch (state) {
    case "uploading": {
      const p = uploadProgress(s);
      const sizeText = p
        ? sizeDisplayName(p.doneBytes, base2) +
          (p.estimatedBytes ? " / " + sizeDisplayName(p.estimatedBytes, base2) : "")
        : "";
      return (
        <Stack gap={4} miw={150} data-testid="status-uploading">
          <Group justify="space-between" gap={4} wrap="nowrap">
            <Text size="xs" fw={600} c="blue" style={{ whiteSpace: "nowrap" }}>
              {p?.percent !== undefined ? `Uploading ${p.percent}%` : "Uploading…"}
            </Text>
            <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
              {sizeText}
            </Text>
          </Group>
          <Tooltip
            label={p?.directory ? `${p.files.toLocaleString()} files · ${p.directory}` : "Uploading"}
            multiline
            maw={360}
          >
            <Progress value={p?.percent ?? 100} size="sm" animated striped={p?.percent === undefined} color="blue" />
          </Tooltip>
        </Stack>
      );
    }
    case "pending":
      return (
        <Tooltip label="Starts after the previous snapshot completes">
          <Badge variant="light" color="gray" leftSection={<Loader size={10} color="gray" />}>
            Pending
          </Badge>
        </Tooltip>
      );
    case "paused":
      return (
        <Badge variant="light" color="gray">
          Paused
        </Badge>
      );
    case "never":
      return (
        <Badge variant="outline" color="gray">
          Never backed up
        </Badge>
      );
    case "overdue":
      return (
        <Badge variant="light" color="yellow" leftSection={<IconAlertTriangle size={12} />}>
          Overdue
        </Badge>
      );
    default:
      return (
        <Badge variant="light" color="green">
          Protected
        </Badge>
      );
  }
}

function ErrorBadge({ s }: { s: SourceStatus }) {
  const n = failedCount(s);
  if (!n) return null;
  return (
    <Tooltip label={failureDetails(s) || `${n} errors`} multiline maw={420} style={{ whiteSpace: "pre-wrap" }}>
      <Badge size="xs" variant="light" color="orange" leftSection={<IconAlertTriangle size={10} />}>
        {n} {n === 1 ? "error" : "errors"}
      </Badge>
    </Tooltip>
  );
}

function NextSnapshot({ s, now }: { s: SourceStatus; now: number }) {
  if (s.status === "UPLOADING") return null;
  if (!s.nextSnapshotTime) {
    return (
      <Text size="sm" c="dimmed">
        {s.status === "PAUSED" ? "paused" : "manual"}
      </Text>
    );
  }
  return (
    <Group gap={6}>
      <Text size="sm" title={absoluteTime(s.nextSnapshotTime)} style={{ whiteSpace: "nowrap" }}>
        {relativeTime(s.nextSnapshotTime, now)}
      </Text>
      {isOverdue(s, now) && (
        <Badge size="xs" color="yellow" variant="light">
          overdue
        </Badge>
      )}
    </Group>
  );
}

function SourceActions({
  s,
  busy,
  onStart,
  onCancel,
}: {
  s: SourceStatus;
  busy: boolean;
  onStart: (s: SourceInfo) => void;
  onCancel: (s: SourceInfo) => void;
}) {
  return (
    <Group gap={4} justify="flex-end" wrap="nowrap">
      {isActive(s) ? (
        <Tooltip label="Stop snapshot">
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label="Stop snapshot"
            loading={busy}
            onClick={() => onCancel(s.source)}
          >
            <IconPlayerStop size={18} />
          </ActionIcon>
        </Tooltip>
      ) : (
        <Tooltip label="Snapshot now">
          <ActionIcon variant="subtle" aria-label="Snapshot now" loading={busy} onClick={() => onStart(s.source)}>
            <IconPlayerPlay size={18} />
          </ActionIcon>
        </Tooltip>
      )}
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label="More actions">
            <IconDots size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item component={Link} to={sourceDetailPath(s.source)} leftSection={<IconHistory size={16} />}>
            Snapshot history
          </Menu.Item>
          <Menu.Item component={Link} to={policyEditorPath(s.source)} leftSection={<IconShieldCheck size={16} />}>
            Edit policy
          </Menu.Item>
          {s.currentTask && (
            <Menu.Item
              component={Link}
              to={"/tasks/" + encodeURIComponent(s.currentTask)}
              leftSection={<IconListDetails size={16} />}
            >
              Task details
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

export function DashboardPage() {
  const sources = useSources();
  const prefs = usePreferences();
  const now = useNow();
  const base2 = prefs.bytesStringBase2;

  const [ownerChoice, setOwnerChoice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);

  const data = sources.data;
  const localOwner = data ? data.localUsername + "@" + data.localHost : "";
  const owner = ownerChoice ?? (prefs.defaultSnapshotViewAll ? ALL_OWNERS : LOCAL_OWNER);

  const owners = useMemo(() => [...new Set((data?.sources ?? []).map((s) => ownerName(s.source)))].sort(), [data]);
  const ownerSources = useMemo(
    // Without multi-user mode the server only returns local sources; don't filter.
    () => (data ? (data.multiUser ? filterByOwner(data.sources, owner, localOwner) : data.sources) : []),
    [data, owner, localOwner],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ownerSources
      .filter((s) => !q || s.source.path.toLowerCase().includes(q) || ownerName(s.source).toLowerCase().includes(q))
      .sort(
        (a, b) => a.source.path.localeCompare(b.source.path) || ownerName(a.source).localeCompare(ownerName(b.source)),
      );
  }, [ownerSources, query]);

  const run = async (src: SourceInfo, action: () => Promise<unknown>, errorTitle: string) => {
    const key = sourceKey(src);
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      await action();
      await sources.refresh();
    } catch (err) {
      showError(errorTitle, err);
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };
  const startSnapshot = (src: SourceInfo) => run(src, () => api.sources.upload(src), "Could not start snapshot");
  const cancelSnapshot = (src: SourceInfo) => run(src, () => api.sources.cancel(src), "Could not stop snapshot");

  const sync = async () => {
    setSyncing(true);
    try {
      await api.repo.sync();
      await sources.refresh();
    } catch (err) {
      showError("Synchronization failed", err);
    } finally {
      setSyncing(false);
    }
  };

  const header = (
    <PageHeader
      title="Snapshots"
      description="Everything that is backed up into this repository."
      actions={
        <>
          <Tooltip label="Synchronize with repository">
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Synchronize"
              loading={syncing}
              onClick={() => void sync()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Button component={Link} to="/snapshots/new" leftSection={<IconPlus size={16} />}>
            New snapshot
          </Button>
        </>
      }
    />
  );

  if (sources.isLoading) {
    return (
      <>
        {header}
        <Center py="xl">
          <Loader />
        </Center>
      </>
    );
  }

  if (!data) {
    return (
      <>
        {header}
        <Alert color="red" title="Could not load snapshot sources" icon={<IconAlertTriangle />}>
          {sources.error?.message}
        </Alert>
      </>
    );
  }

  const withSnapshots = ownerSources.filter((s) => s.lastSnapshot).length;
  const protectedBytes = ownerSources.reduce((sum, s) => sum + totalSize(s), 0);
  const next = nextScheduled(ownerSources, now);
  const attention = ownerSources.filter((s) => needsAttention(s, now));
  const failing = attention.filter((s) => failedCount(s) > 0).length;
  const overdue = attention.length - failing;

  return (
    <>
      {header}

      {sources.error && (
        <Alert color="yellow" icon={<IconAlertTriangle />} mb="md" title="Showing last known state">
          {sources.error.message}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 2, lg: 4 }} spacing={{ base: "xs", sm: "md" }} mb="lg">
        <StatCard
          label="Sources"
          value={ownerSources.length}
          hint={`${withSnapshots} with snapshots`}
          icon={IconArchive}
        />
        <StatCard
          label="Protected data"
          value={sizeDisplayName(protectedBytes, base2)}
          hint="size of latest snapshots"
          icon={IconDatabase}
          color="cyan"
        />
        <StatCard
          label="Next snapshot"
          value={next ? relativeTime(next.nextSnapshotTime, now) : "—"}
          hint={next ? next.source.path : "nothing scheduled"}
          icon={IconClockPlay}
          color="blue"
        />
        <StatCard
          label="Needs attention"
          value={attention.length}
          hint={
            attention.length
              ? [failing && `${failing} with errors`, overdue && `${overdue} overdue`].filter(Boolean).join(" · ")
              : "all good"
          }
          icon={IconAlertTriangle}
          color={attention.length ? "orange" : "green"}
        />
      </SimpleGrid>

      <Card padding={0}>
        <Group p="md" justify="space-between" gap="sm">
          <TextInput
            placeholder="Filter by path or owner"
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            w={{ base: "100%", sm: 280 }}
            aria-label="Filter sources"
          />
          {data.multiUser && (
            <Select
              aria-label="Owner"
              size="sm"
              w={{ base: "100%", sm: 240 }}
              value={owner}
              onChange={(v) => setOwnerChoice(v ?? LOCAL_OWNER)}
              allowDeselect={false}
              data={[
                {
                  group: "Show",
                  items: [
                    { value: LOCAL_OWNER, label: `This computer (${localOwner})` },
                    { value: ALL_OWNERS, label: "All owners" },
                  ],
                },
                { group: "Owner", items: owners.map((o) => ({ value: o, label: o })) },
              ]}
            />
          )}
        </Group>

        {visible.length === 0 ? (
          <Stack align="center" gap="xs" py="xl" px="md" ta="center">
            <Text c="dimmed">{ownerSources.length ? "No sources match the filter." : "Nothing is backed up yet."}</Text>
            {!ownerSources.length && (
              <Button component={Link} to="/snapshots/new" variant="light" leftSection={<IconPlus size={16} />}>
                Create your first snapshot
              </Button>
            )}
          </Stack>
        ) : (
          <>
            {/* Phones: compact list */}
            <Stack hiddenFrom="sm" gap={0}>
              {visible.map((s) => (
                <Group
                  key={sourceKey(s.source)}
                  justify="space-between"
                  wrap="nowrap"
                  align="flex-start"
                  gap="xs"
                  px="md"
                  py="sm"
                  style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
                >
                  <Stack gap={6} style={{ minWidth: 0 }}>
                    <Box>
                      <Anchor
                        component={Link}
                        to={sourceDetailPath(s.source)}
                        size="sm"
                        fw={600}
                        c="var(--mantine-color-text)"
                        style={{ wordBreak: "break-all" }}
                      >
                        {s.source.path}
                      </Anchor>
                      <Text size="xs" c="dimmed">
                        {ownerName(s.source)}
                        {s.lastSnapshot &&
                          ` · ${relativeTime(s.lastSnapshot.startTime, now)} · ${sizeDisplayName(totalSize(s), base2)}`}
                      </Text>
                    </Box>
                    <Group gap={6}>
                      <StatusCell s={s} base2={base2} now={now} />
                      <ErrorBadge s={s} />
                    </Group>
                  </Stack>
                  <SourceActions
                    s={s}
                    busy={!!busy[sourceKey(s.source)]}
                    onStart={startSnapshot}
                    onCancel={cancelSnapshot}
                  />
                </Group>
              ))}
            </Stack>

            {/* Tablet and up: table */}
            <Table.ScrollContainer minWidth={820} visibleFrom="sm">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Path</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Last snapshot</Table.Th>
                    <Table.Th ta="right">Size</Table.Th>
                    <Table.Th>Next</Table.Th>
                    <Table.Th w={90}>
                      <Box
                        component="span"
                        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}
                      >
                        Actions
                      </Box>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {visible.map((s) => (
                    <Table.Tr key={sourceKey(s.source)} data-testid="source-row">
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <IconFolder
                            size={20}
                            stroke={1.5}
                            color="var(--mantine-primary-color-filled)"
                            style={{ flexShrink: 0 }}
                          />
                          <Stack gap={0} style={{ minWidth: 0 }}>
                            <Anchor
                              component={Link}
                              to={sourceDetailPath(s.source)}
                              size="sm"
                              fw={600}
                              c="var(--mantine-color-text)"
                              style={{ wordBreak: "break-all" }}
                            >
                              {s.source.path}
                            </Anchor>
                            <Text size="xs" c="dimmed">
                              {ownerName(s.source)}
                            </Text>
                          </Stack>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <StatusCell s={s} base2={base2} now={now} />
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6}>
                          <Text
                            size="sm"
                            title={absoluteTime(s.lastSnapshot?.startTime)}
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {s.lastSnapshot ? relativeTime(s.lastSnapshot.startTime, now) : "—"}
                          </Text>
                          <ErrorBadge s={s} />
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>
                          {s.lastSnapshot ? sizeDisplayName(totalSize(s), base2) : "—"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <NextSnapshot s={s} now={now} />
                      </Table.Td>
                      <Table.Td>
                        <SourceActions
                          s={s}
                          busy={!!busy[sourceKey(s.source)]}
                          onStart={startSnapshot}
                          onCancel={cancelSnapshot}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </>
        )}
      </Card>
    </>
  );
}
