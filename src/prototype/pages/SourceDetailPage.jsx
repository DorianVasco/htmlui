import React, { useState } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Drawer,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconDownload,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconPin,
  IconPlayerPlay,
  IconRestore,
  IconShieldCheck,
  IconTrash,
} from "@tabler/icons-react";
import { snapshotsFor } from "../mockData";
import { ErrorCount, PageHeader, StatCard } from "../components";
import { ownerName, relativeTime, sizeDisplayName } from "../format";

const retentionColor = (r) => {
  if (r.startsWith("latest")) return "teal";
  if (r.startsWith("hourly")) return "cyan";
  if (r.startsWith("daily")) return "blue";
  if (r.startsWith("weekly")) return "indigo";
  if (r.startsWith("monthly")) return "grape";
  return "pink";
};

const browseEntries = [
  { name: "Invoices", dir: true, size: 1.2e9, mtime: -3 },
  { name: "Taxes 2026", dir: true, size: 340e6, mtime: -12 },
  { name: "Contracts", dir: true, size: 88e6, mtime: -40 },
  { name: "notes.md", dir: false, size: 18e3, mtime: -1 },
  { name: "passport-scan.pdf", dir: false, size: 2.4e6, mtime: -200 },
];

function BrowseDrawer({ snapshot, onClose, onRestore }) {
  return (
    <Drawer opened={!!snapshot} onClose={onClose} position="right" size="lg" title="Browse snapshot">
      {snapshot && (
        <Stack>
          <Text size="sm" c="dimmed">
            {new Date(snapshot.startTime).toLocaleString()} · <Text span ff="monospace">{snapshot.id.slice(0, 12)}…</Text>
          </Text>
          <Group gap="xs">
            <Button size="xs" leftSection={<IconRestore size={14} />} onClick={onRestore}>
              Restore…
            </Button>
            <Button size="xs" variant="default" leftSection={<IconFolderOpen size={14} />}>
              Mount as folder
            </Button>
          </Group>
          <Table>
            <Table.Tbody>
              {browseEntries.map((e) => (
                <Table.Tr key={e.name} style={{ cursor: "pointer" }}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {e.dir ? <IconFolder size={18} color="var(--mantine-color-yellow-6)" /> : <IconFile size={18} stroke={1.5} />}
                      <Text size="sm">{e.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="dimmed" ff="monospace">
                      {sizeDisplayName(e.size)}
                    </Text>
                  </Table.Td>
                  <Table.Td w={40}>
                    {!e.dir && (
                      <ActionIcon variant="subtle" size="sm" aria-label="Download">
                        <IconDownload size={16} />
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      )}
    </Drawer>
  );
}

function RestoreModal({ snapshot, onClose, path }) {
  return (
    <Modal
      opened={!!snapshot}
      onClose={onClose}
      title={snapshot ? `Restore snapshot from ${new Date(snapshot.startTime).toLocaleString()}` : ""}
      centered
      size="lg"
    >
      <Stack>
        <TextInput label="Restore to" defaultValue={path + " (restored)"} leftSection={<IconFolder size={16} />} />
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <Switch label="Overwrite existing files" />
          <Switch label="Restore file permissions" defaultChecked />
          <Switch label="Restore timestamps" defaultChecked />
          <Switch label="Skip unreadable files" />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button leftSection={<IconRestore size={16} />} onClick={onClose}>
            Start restore
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function SourceDetailPage({ source, navigate }) {
  const snapshots = snapshotsFor(source);
  const [selected, setSelected] = useState([]);
  const [browsing, setBrowsing] = useState(null);
  const [restoring, setRestoring] = useState(null);

  const toggle = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <>
      <Breadcrumbs mb="sm" fz="sm">
        <Anchor onClick={() => navigate({ page: "snapshots" })}>Snapshots</Anchor>
        <Text size="sm" c="dimmed">
          {ownerName(source.source)}
        </Text>
      </Breadcrumbs>

      <PageHeader
        title={source.source.path}
        description={`Snapshots of ${ownerName(source.source)}`}
        actions={
          <>
            <Button variant="default" leftSection={<IconShieldCheck size={16} />} onClick={() => navigate({ page: "policies" })}>
              Policy
            </Button>
            <Button leftSection={<IconPlayerPlay size={16} />}>Snapshot now</Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, xs: 3 }} mb="lg">
        <StatCard label="Snapshots" value={snapshots.length} hint={`${snapshots.filter((s) => s.pins.length).length} pinned`} />
        <StatCard label="Latest size" value={source.lastSnapshot ? sizeDisplayName(source.lastSnapshot.totalSize) : "—"} hint={source.lastSnapshot ? `${source.lastSnapshot.files.toLocaleString()} files` : ""} color="cyan" />
        <StatCard label="Last run" value={source.lastSnapshot ? relativeTime(source.lastSnapshot.startTime) : "never"} hint={source.nextSnapshotTime ? `next ${relativeTime(source.nextSnapshotTime)}` : "manual schedule"} color="blue" />
      </SimpleGrid>

      <Card padding={0}>
        <Group p="md" justify="space-between">
          <Text fw={600}>History</Text>
          <Group gap="xs">
            <Switch size="xs" label="Show hidden" />
            <Button size="xs" color="red" variant="light" leftSection={<IconTrash size={14} />} disabled={!selected.length}>
              Delete {selected.length || ""}
            </Button>
          </Group>
        </Group>
        <Table.ScrollContainer minWidth={760}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40} />
                <Table.Th>Started</Table.Th>
                <Table.Th>Retention</Table.Th>
                <Table.Th ta="right">Size</Table.Th>
                <Table.Th ta="right">Files</Table.Th>
                <Table.Th w={110} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {snapshots.map((s) => (
                <Table.Tr key={s.id} bg={selected.includes(s.id) ? "var(--mantine-primary-color-light)" : undefined}>
                  <Table.Td>
                    <Checkbox checked={selected.includes(s.id)} onChange={() => toggle(s.id)} aria-label="Select snapshot" />
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={0}>
                      <Group gap={6}>
                        <Text size="sm" fw={500}>
                          {new Date(s.startTime).toLocaleString()}
                        </Text>
                        {s.pins.length > 0 && (
                          <Tooltip label={"Pinned: " + s.pins.join(", ")}>
                            <IconPin size={14} color="var(--mantine-color-orange-6)" />
                          </Tooltip>
                        )}
                        <ErrorCount count={s.errors} />
                      </Group>
                      <Text size="xs" c="dimmed">
                        {s.description || relativeTime(s.startTime)}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {s.retention.map((r) => (
                        <Badge key={r} size="xs" variant="light" tt="none" color={retentionColor(r)}>
                          {r}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" ff="monospace">
                      {sizeDisplayName(s.totalSize)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" ff="monospace">
                      {s.files.toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Browse">
                        <ActionIcon variant="subtle" aria-label="Browse" onClick={() => setBrowsing(s)}>
                          <IconFolderOpen size={18} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Restore">
                        <ActionIcon variant="subtle" aria-label="Restore" onClick={() => setRestoring(s)}>
                          <IconRestore size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {snapshots.length === 0 && (
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
      </Card>

      <BrowseDrawer
        snapshot={browsing}
        onClose={() => setBrowsing(null)}
        onRestore={() => {
          setRestoring(browsing);
          setBrowsing(null);
        }}
      />
      <RestoreModal snapshot={restoring} onClose={() => setRestoring(null)} path={source.source.path} />
    </>
  );
}
