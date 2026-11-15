// Drawer that browses the files of a snapshot: folders open in place, files can
// be downloaded, and anything can be restored. The snapshot can also be mounted
// as a folder on the server's computer.
import React, { useState } from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Center,
  CopyButton,
  Drawer,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconRestore,
} from "@tabler/icons-react";
import { api, useDirectory, useMount } from "../../../api";
import type { DirEntry, Snapshot } from "../../../api";
import { absoluteTime, sizeDisplayName } from "../../format";
import { usePreferences } from "../../preferences";

export const isDirectory = (e: DirEntry) => e.type === "d";

/** Folders first, then by name. */
export function sortEntries(entries: DirEntry[]): DirEntry[] {
  return [...entries].sort((a, b) => Number(isDirectory(b)) - Number(isDirectory(a)) || a.name.localeCompare(b.name));
}

const entrySize = (e: DirEntry) => (isDirectory(e) ? e.summ?.size : e.size);

interface Crumb {
  name: string;
  oid: string;
}

function MountControls({ oid }: { oid: string }) {
  const mount = useMount(oid);
  const [busy, setBusy] = useState(false);
  // GET /mounts/{oid} answers 404 when not mounted.
  const path = mount.error ? undefined : mount.data?.path;

  const act = async (fn: () => Promise<unknown>, title: string) => {
    setBusy(true);
    try {
      await fn();
      await mount.refresh();
    } catch (err) {
      notifications.show({ color: "red", title, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  if (!path) {
    return (
      <Button
        size="xs"
        variant="default"
        leftSection={<IconFolderOpen size={14} />}
        loading={busy || mount.isLoading}
        onClick={() => void act(() => api.mounts.mount(oid), "Could not mount snapshot")}
      >
        Mount as folder
      </Button>
    );
  }
  return (
    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 220 }}>
      <TextInput
        size="xs"
        readOnly
        value={path}
        aria-label="Mounted at"
        style={{ flex: 1 }}
        rightSection={
          <CopyButton value={path}>
            {({ copied, copy }) => (
              <ActionIcon size="sm" variant="subtle" onClick={copy} aria-label="Copy path">
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              </ActionIcon>
            )}
          </CopyButton>
        }
      />
      {window.kopiaUI?.browseDirectory && (
        <Tooltip label="Open in file manager">
          <ActionIcon
            variant="default"
            aria-label="Open in file manager"
            onClick={() => window.kopiaUI?.browseDirectory(path)}
          >
            <IconExternalLink size={16} />
          </ActionIcon>
        </Tooltip>
      )}
      <Button
        size="xs"
        variant="default"
        loading={busy}
        onClick={() => void act(() => api.mounts.unmount(oid), "Could not unmount snapshot")}
      >
        Unmount
      </Button>
    </Group>
  );
}

export function SnapshotBrowser({
  snapshot,
  onClose,
  onRestore,
}: {
  snapshot: Snapshot | null;
  onClose: () => void;
  /** Restore the given object; `relPath` is its path inside the snapshot ("" for the root). */
  onRestore: (oid: string, name: string, relPath: string) => void;
}) {
  return (
    <Drawer opened={!!snapshot} onClose={onClose} position="right" size="xl" title="Browse snapshot">
      {snapshot && <BrowserContent key={snapshot.id} snapshot={snapshot} onRestore={onRestore} />}
    </Drawer>
  );
}

function BrowserContent({
  snapshot,
  onRestore,
}: {
  snapshot: Snapshot;
  onRestore: (oid: string, name: string, relPath: string) => void;
}) {
  const { bytesStringBase2: base2 } = usePreferences();
  const [trail, setTrail] = useState<Crumb[]>([]);
  const current = trail.length ? trail[trail.length - 1].oid : snapshot.rootID;
  const dir = useDirectory(current);
  const relPath = (name?: string) => [...trail.map((c) => c.name), ...(name ? [name] : [])].join("/");

  const entries = dir.data ? sortEntries(dir.data.entries ?? []) : [];

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        {absoluteTime(snapshot.startTime)} ·{" "}
        <Text span ff="monospace" size="sm">
          {snapshot.id.slice(0, 12)}
        </Text>
      </Text>
      <Group gap="xs">
        <Button
          size="xs"
          leftSection={<IconRestore size={14} />}
          onClick={() => onRestore(current, trail.length ? trail[trail.length - 1].name : "", relPath())}
        >
          {trail.length ? "Restore this folder…" : "Restore all…"}
        </Button>
        <MountControls oid={snapshot.rootID} />
      </Group>

      <Breadcrumbs separatorMargin={4} fz="sm" style={{ flexWrap: "wrap" }}>
        <Anchor size="sm" onClick={() => setTrail([])}>
          (root)
        </Anchor>
        {trail.map((c, i) =>
          i === trail.length - 1 ? (
            <Text key={c.oid} size="sm" fw={500}>
              {c.name}
            </Text>
          ) : (
            <Anchor key={c.oid} size="sm" onClick={() => setTrail(trail.slice(0, i + 1))}>
              {c.name}
            </Anchor>
          ),
        )}
      </Breadcrumbs>

      {dir.isLoading ? (
        <Center py="lg">
          <Loader size="sm" />
        </Center>
      ) : dir.error && !dir.data ? (
        <Alert color="red" title="Could not open folder">
          {dir.error.message}
        </Alert>
      ) : (
        <Table.ScrollContainer minWidth={420}>
          <Table highlightOnHover>
            <Table.Tbody>
              {entries.map((e) => (
                <Table.Tr
                  key={e.obj + e.name}
                  style={isDirectory(e) ? { cursor: "pointer" } : undefined}
                  onClick={isDirectory(e) ? () => setTrail([...trail, { name: e.name, oid: e.obj }]) : undefined}
                >
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {isDirectory(e) ? (
                        <IconFolder size={18} color="var(--mantine-color-yellow-6)" />
                      ) : (
                        <IconFile size={18} stroke={1.5} />
                      )}
                      <Text size="sm" style={{ wordBreak: "break-all" }}>
                        {e.name}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td visibleFrom="sm">
                    <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                      {absoluteTime(e.mtime)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="dimmed" ff="monospace" style={{ whiteSpace: "nowrap" }}>
                      {entrySize(e) !== undefined ? sizeDisplayName(entrySize(e), base2) : ""}
                    </Text>
                  </Table.Td>
                  <Table.Td w={76}>
                    <Group gap={2} justify="flex-end" wrap="nowrap" onClick={(ev) => ev.stopPropagation()}>
                      {!isDirectory(e) && (
                        <Tooltip label="Download">
                          <ActionIcon
                            component="a"
                            href={api.objects.downloadUrl(e.obj, e.name)}
                            download={e.name}
                            variant="subtle"
                            size="sm"
                            aria-label={`Download ${e.name}`}
                          >
                            <IconDownload size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {isDirectory(e) && (
                        <Tooltip label="Restore…">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            aria-label={`Restore ${e.name}`}
                            onClick={() => onRestore(e.obj, e.name, relPath(e.name))}
                          >
                            <IconRestore size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {entries.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text ta="center" c="dimmed" py="md" size="sm">
                      This folder is empty.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
