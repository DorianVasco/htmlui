// Snapshot history of one source (/snapshots/single-source?userName=…&host=…&path=…,
// the same URL as the old UI): stats, the list of snapshots with retention and
// pins, deleting, browsing files and restoring.
import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Loader,
  Menu,
  Modal,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconDots,
  IconFolderOpen,
  IconPin,
  IconPlayerPlay,
  IconPlayerStop,
  IconRestore,
  IconShieldCheck,
  IconTrash,
} from "@tabler/icons-react";
import { api, useSnapshots, useSources } from "../../../api";
import type { Snapshot, SourceInfo } from "../../../api";
import { PageHeader, StatCard } from "../../components";
import { absoluteTime, ownerName, relativeTime, sizeDisplayName } from "../../format";
import { legacy } from "../../legacy";
import { usePreferences } from "../../preferences";
import { isActive } from "../../sourceStatus";
import { RestoreModal, RestoreTarget } from "./RestoreModal";
import { SnapshotBrowser } from "./SnapshotBrowser";

/** Route path of this page, relative to the app's basename. */
export function sourceDetailPath(src: SourceInfo): string {
  const q = new URLSearchParams({ userName: src.userName, host: src.host, path: src.path });
  return "/snapshots/single-source?" + q.toString();
}

export function retentionColor(r: string): string {
  if (r.startsWith("latest")) return "teal";
  if (r.startsWith("hourly")) return "cyan";
  if (r.startsWith("daily")) return "blue";
  if (r.startsWith("weekly")) return "indigo";
  if (r.startsWith("monthly")) return "grape";
  return "pink";
}

/** Joins a path on the server, using the separator the source path uses. */
function joinServerPath(base: string, rel: string): string {
  if (!rel) return base;
  const sep = base.includes("\\") ? "\\" : "/";
  return base.replace(/[\\/]+$/, "") + sep + rel.split("/").join(sep);
}

function showError(title: string, err: unknown) {
  notifications.show({ color: "red", title, message: err instanceof Error ? err.message : String(err) });
}

function SnapshotErrors({ s }: { s: Snapshot }) {
  const n = s.summary?.numFailed ?? 0;
  if (!n) return null;
  const details = (s.summary?.errors ?? []).map((e) => `${e.path}: ${e.error}`).join("\n");
  return (
    <Tooltip label={details || `${n} errors`} multiline maw={420} style={{ whiteSpace: "pre-wrap" }}>
      <Badge size="xs" variant="light" color="orange" leftSection={<IconAlertTriangle size={10} />}>
        {n} {n === 1 ? "error" : "errors"}
      </Badge>
    </Tooltip>
  );
}

function DeleteModal({
  opened,
  count,
  all,
  busy,
  onCancel,
  onConfirm,
}: {
  opened: boolean;
  count: number;
  all: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={all ? "Delete this source?" : `Delete ${count === 1 ? "snapshot" : count + " snapshots"}?`}
      centered
    >
      <Stack>
        <Text size="sm">
          {all
            ? "All snapshots of this folder and its policy will be deleted. Kopia will no longer back it up."
            : `The selected ${count === 1 ? "snapshot is" : "snapshots are"} deleted from the repository.`}{" "}
          This cannot be undone.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button color="red" leftSection={<IconTrash size={16} />} loading={busy} onClick={onConfirm}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function SourceDetailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { bytesStringBase2: base2 } = usePreferences();

  const userName = params.get("userName") ?? "";
  const host = params.get("host") ?? "";
  const path = params.get("path") ?? "";
  const source = useMemo<SourceInfo | null>(() => (path ? { userName, host, path } : null), [userName, host, path]);

  const [showHidden, setShowHidden] = useState(false);
  const snapshots = useSnapshots(source, { all: showHidden });
  const sources = useSources();
  const status = sources.data?.sources.find(
    (s) => s.source.userName === userName && s.source.host === host && s.source.path === path,
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [browsing, setBrowsing] = useState<Snapshot | null>(null);
  const [restoring, setRestoring] = useState<RestoreTarget | null>(null);
  const [deleting, setDeleting] = useState<"selected" | "source" | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(
    () => [...(snapshots.data?.snapshots ?? [])].sort((a, b) => b.startTime.localeCompare(a.startTime)),
    [snapshots.data],
  );
  // Drop selections that are no longer listed (deleted, or hidden again).
  const selectedIds = selected.filter((id) => list.some((s) => s.id === id));
  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const allSelected = list.length > 0 && selectedIds.length === list.length;

  if (!source) {
    return (
      <Alert color="red" title="No source selected">
        <Anchor component={Link} to="/snapshots">
          Back to snapshots
        </Anchor>
      </Alert>
    );
  }

  const restoreSnapshot = (s: Snapshot) =>
    setRestoring({
      oid: s.rootID,
      title: `snapshot from ${absoluteTime(s.startTime)}`,
      defaultDestination: path + " (restored)",
    });

  const snapshotAction = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true);
    try {
      await fn();
      await sources.refresh();
    } catch (err) {
      showError(title, err);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      if (deleting === "source") {
        await api.snapshots.deleteSource(source);
        notifications.show({ color: "green", message: `Deleted ${path} and its snapshots.` });
        navigate("/snapshots");
        return;
      }
      await api.snapshots.delete({ source, snapshotManifestIds: selectedIds });
      setSelected([]);
      await snapshots.refresh();
    } catch (err) {
      showError("Could not delete", err);
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  const latest = list.find((s) => !s.incomplete);
  const pinnedCount = list.filter((s) => s.pins?.length).length;
  const hiddenCount =
    snapshots.data && !showHidden ? Math.max(0, snapshots.data.unfilteredCount - snapshots.data.snapshots.length) : 0;
  const running = status && isActive(status);

  return (
    <>
      <Breadcrumbs mb="sm" fz="sm">
        <Anchor component={Link} to="/snapshots" size="sm">
          Snapshots
        </Anchor>
        <Text size="sm" c="dimmed">
          {ownerName(source)}
        </Text>
      </Breadcrumbs>

      <PageHeader
        title={path}
        description={`Snapshots of ${ownerName(source)}`}
        actions={
          <>
            <Button
              component="a"
              href={legacy.policy(source)}
              variant="default"
              leftSection={<IconShieldCheck size={16} />}
            >
              Policy
            </Button>
            {status &&
              (running ? (
                <Button
                  color="red"
                  variant="light"
                  leftSection={<IconPlayerStop size={16} />}
                  loading={busy}
                  onClick={() => void snapshotAction(() => api.sources.cancel(source), "Could not stop snapshot")}
                >
                  Stop
                </Button>
              ) : (
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  loading={busy}
                  onClick={() => void snapshotAction(() => api.sources.upload(source), "Could not start snapshot")}
                >
                  Snapshot now
                </Button>
              ))}
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="default" size="lg" aria-label="More actions">
                  <IconDots size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => setDeleting("source")}>
                  Delete source and all snapshots…
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, xs: 3 }} mb="lg">
        <StatCard
          label="Snapshots"
          value={snapshots.data ? list.length : "—"}
          hint={
            [pinnedCount ? `${pinnedCount} pinned` : "", hiddenCount ? `${hiddenCount} hidden` : ""]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        />
        <StatCard
          label="Latest size"
          value={latest?.summary?.size !== undefined ? sizeDisplayName(latest.summary.size, base2) : "—"}
          hint={latest?.summary?.files !== undefined ? `${latest.summary.files.toLocaleString()} files` : undefined}
        />
        <StatCard
          label="Last run"
          value={latest ? relativeTime(latest.startTime) : "never"}
          hint={
            status?.nextSnapshotTime
              ? `next ${relativeTime(status.nextSnapshotTime)}`
              : status
                ? "manual schedule"
                : undefined
          }
        />
      </SimpleGrid>

      <Card padding={0}>
        <Group p="md" justify="space-between">
          <Text fw={600}>History</Text>
          <Group gap="md">
            <Tooltip label="Also show snapshots that are identical to a newer one" multiline maw={260}>
              <Switch
                size="xs"
                label="Show identical"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.currentTarget.checked)}
              />
            </Tooltip>
            <Button
              size="xs"
              color="red"
              variant="light"
              leftSection={<IconTrash size={14} />}
              disabled={!selectedIds.length}
              onClick={() => setDeleting("selected")}
            >
              Delete{selectedIds.length ? " " + selectedIds.length : ""}
            </Button>
          </Group>
        </Group>

        {snapshots.isLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : snapshots.error && !snapshots.data ? (
          <Alert color="red" m="md" title="Could not load snapshots">
            {snapshots.error.message}
          </Alert>
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <Checkbox
                      aria-label="Select all snapshots"
                      checked={allSelected}
                      indeterminate={selectedIds.length > 0 && !allSelected}
                      onChange={() => setSelected(allSelected ? [] : list.map((s) => s.id))}
                      disabled={!list.length}
                    />
                  </Table.Th>
                  <Table.Th>Started</Table.Th>
                  <Table.Th>Retention</Table.Th>
                  <Table.Th ta="right">Size</Table.Th>
                  <Table.Th ta="right">Files</Table.Th>
                  <Table.Th w={90} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {list.map((s) => (
                  <Table.Tr
                    key={s.id}
                    bg={selectedIds.includes(s.id) ? "var(--mantine-primary-color-light)" : undefined}
                    data-testid="snapshot-row"
                  >
                    <Table.Td>
                      <Checkbox
                        checked={selectedIds.includes(s.id)}
                        onChange={() => toggle(s.id)}
                        aria-label={`Select snapshot from ${absoluteTime(s.startTime)}`}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Group gap={6}>
                          <Anchor size="sm" fw={500} c="var(--mantine-color-text)" onClick={() => setBrowsing(s)}>
                            {absoluteTime(s.startTime)}
                          </Anchor>
                          {!!s.pins?.length && (
                            <Tooltip label={"Pinned: " + s.pins.join(", ")}>
                              <IconPin size={14} color="var(--mantine-color-orange-6)" aria-label="Pinned" />
                            </Tooltip>
                          )}
                          {s.incomplete && (
                            <Tooltip label={s.incomplete}>
                              <Badge size="xs" variant="light" color="yellow">
                                incomplete
                              </Badge>
                            </Tooltip>
                          )}
                          <SnapshotErrors s={s} />
                        </Group>
                        <Text size="xs" c="dimmed">
                          {s.description || relativeTime(s.startTime)}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {(s.retention ?? []).map((r) => (
                          <Badge key={r} size="xs" variant="light" tt="none" color={retentionColor(r)}>
                            {r}
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>
                        {s.summary?.size !== undefined ? sizeDisplayName(s.summary.size, base2) : ""}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" ff="monospace">
                        {s.summary?.files?.toLocaleString() ?? ""}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <Tooltip label="Browse files">
                          <ActionIcon variant="subtle" aria-label="Browse files" onClick={() => setBrowsing(s)}>
                            <IconFolderOpen size={18} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Restore…">
                          <ActionIcon variant="subtle" aria-label="Restore" onClick={() => restoreSnapshot(s)}>
                            <IconRestore size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {list.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text ta="center" c="dimmed" py="lg">
                        No snapshots yet.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      <SnapshotBrowser
        snapshot={browsing}
        onClose={() => setBrowsing(null)}
        onRestore={(oid, name, relPath) => {
          const s = browsing;
          setBrowsing(null);
          if (!s) return;
          setRestoring({
            oid,
            title: relPath
              ? `“${name}” from ${absoluteTime(s.startTime)}`
              : `snapshot from ${absoluteTime(s.startTime)}`,
            defaultDestination: joinServerPath(path + " (restored)", relPath),
          });
        }}
      />
      <RestoreModal target={restoring} onClose={() => setRestoring(null)} />
      <DeleteModal
        opened={!!deleting}
        all={deleting === "source"}
        count={selectedIds.length}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
