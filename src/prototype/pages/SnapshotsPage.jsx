import React, { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconAlertTriangle,
  IconArchive,
  IconClockPlay,
  IconDatabase,
  IconDots,
  IconFolder,
  IconHistory,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
} from "@tabler/icons-react";
import { repoStatus, sources } from "../mockData";
import { ErrorCount, PageHeader, StatCard } from "../components";
import { ageInDays, ownerName, relativeTime, sizeDisplayName } from "../format";

const localOwner = ownerName({ userName: repoStatus.username, host: repoStatus.hostname });

function SourceStatus({ s }) {
  if (s.status === "UPLOADING") {
    const pct = Math.round((s.upload.hashedBytes / s.upload.estimatedBytes) * 100);
    return (
      <Stack gap={4} miw={140}>
        <Group justify="space-between" gap={4}>
          <Text size="xs" fw={600} c="blue">
            Uploading {pct}%
          </Text>
          <Text size="xs" c="dimmed">
            {sizeDisplayName(s.upload.hashedBytes)} / {sizeDisplayName(s.upload.estimatedBytes)}
          </Text>
        </Group>
        <Progress value={pct} size="sm" animated color="blue" />
      </Stack>
    );
  }
  if (!s.lastSnapshot) {
    return (
      <Badge variant="outline" color="gray">
        Never backed up
      </Badge>
    );
  }
  if (ageInDays(s.lastSnapshot.startTime) > 7) {
    return (
      <Badge variant="light" color="yellow" leftSection={<IconAlertTriangle size={12} />}>
        Outdated
      </Badge>
    );
  }
  return (
    <Badge variant="light" color="green">
      Protected
    </Badge>
  );
}

function SourceActions({ s, navigate }) {
  return (
    <Group gap={4} justify="flex-end" wrap="nowrap">
      {s.status === "UPLOADING" ? (
        <Tooltip label="Stop">
          <ActionIcon variant="subtle" color="red" aria-label="Stop">
            <IconPlayerStop size={18} />
          </ActionIcon>
        </Tooltip>
      ) : (
        <Tooltip label="Snapshot now">
          <ActionIcon variant="subtle" aria-label="Snapshot now">
            <IconPlayerPlay size={18} />
          </ActionIcon>
        </Tooltip>
      )}
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label="More">
            <IconDots size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconHistory size={16} />} onClick={() => navigate({ page: "source", source: s })}>
            Snapshot history
          </Menu.Item>
          <Menu.Item leftSection={<IconShieldCheck size={16} />} onClick={() => navigate({ page: "policies" })}>
            Edit policy
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

function NewSnapshotModal({ opened, onClose }) {
  return (
    <Modal opened={opened} onClose={onClose} title="New snapshot source" centered size="lg">
      <Stack>
        <TextInput
          label="Path to back up"
          placeholder="e.g. C:\Users\me\Music"
          leftSection={<IconFolder size={16} />}
          data-autofocus
        />
        <Card bg="var(--mantine-color-default-hover)" withBorder={false} padding="sm">
          <Text size="sm" c="dimmed">
            Estimate: 2 340 files · 14.8 GB · ~ 9 min on first run. Effective policy: global defaults.
          </Text>
        </Card>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="light" onClick={onClose}>
            Edit policy
          </Button>
          <Button leftSection={<IconPlayerPlay size={16} />} onClick={onClose}>
            Snapshot now
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function SnapshotsPage({ navigate }) {
  const [filter, setFilter] = useState("local");
  const [query, setQuery] = useState("");
  const [modalOpened, modal] = useDisclosure(false);

  const visible = sources.filter((s) => {
    if (filter === "local" && ownerName(s.source) !== localOwner) return false;
    return s.source.path.toLowerCase().includes(query.toLowerCase());
  });

  const totalSize = sources.reduce((a, s) => a + (s.lastSnapshot?.totalSize || 0), 0);
  const withErrors = sources.filter((s) => s.lastSnapshot?.errors).length;
  const upcoming = sources
    .filter((s) => s.nextSnapshotTime)
    .sort((a, b) => a.nextSnapshotTime.localeCompare(b.nextSnapshotTime))[0];

  return (
    <>
      <PageHeader
        title="Snapshots"
        description="Everything that is backed up into this repository."
        actions={
          <>
            <Tooltip label="Synchronize with repository">
              <ActionIcon variant="default" size="lg" aria-label="Synchronize">
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>
              New snapshot
            </Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 2, lg: 4 }} spacing={{ base: "xs", sm: "md" }} mb="lg">
        <StatCard
          label="Sources"
          value={sources.length}
          hint={`${sources.filter((s) => s.lastSnapshot).length} with snapshots`}
          icon={IconArchive}
        />
        <StatCard
          label="Protected data"
          value={sizeDisplayName(totalSize)}
          hint={`Repository: ${sizeDisplayName(repoStatus.totalSize)}`}
          icon={IconDatabase}
          color="cyan"
        />
        <StatCard
          label="Next snapshot"
          value={relativeTime(upcoming?.nextSnapshotTime)}
          hint={upcoming?.source.path}
          icon={IconClockPlay}
          color="blue"
        />
        <StatCard
          label="Attention"
          value={withErrors}
          hint="sources with errors in last run"
          icon={IconAlertTriangle}
          color="orange"
        />
      </SimpleGrid>

      <Card padding={0}>
        <Group p="md" justify="space-between" gap="sm">
          <TextInput
            placeholder="Filter by path"
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            w={{ base: "100%", sm: 280 }}
          />
          <SegmentedControl
            size="xs"
            value={filter}
            onChange={setFilter}
            data={[
              { label: "This computer", value: "local" },
              { label: "All users", value: "all" },
            ]}
          />
        </Group>
        <Stack hiddenFrom="sm" gap={0}>
          {visible.map((s) => (
            <UnstyledButton
              key={ownerName(s.source) + s.source.path}
              onClick={() => navigate({ page: "source", source: s })}
              px="md"
              py="sm"
              style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
                <Stack gap={6} style={{ minWidth: 0 }}>
                  <Stack gap={0}>
                    <Text size="sm" fw={600} style={{ wordBreak: "break-all" }}>
                      {s.source.path}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {ownerName(s.source)} ·{" "}
                      {s.lastSnapshot
                        ? relativeTime(s.lastSnapshot.startTime) + " · " + sizeDisplayName(s.lastSnapshot.totalSize)
                        : "no snapshots"}
                    </Text>
                  </Stack>
                  <Group gap={6}>
                    <SourceStatus s={s} />
                    <ErrorCount count={s.lastSnapshot?.errors} />
                  </Group>
                </Stack>
                <Box onClick={(e) => e.stopPropagation()}>
                  <SourceActions s={s} navigate={navigate} />
                </Box>
              </Group>
            </UnstyledButton>
          ))}
          {visible.length === 0 && (
            <Text ta="center" c="dimmed" py="lg">
              No sources match.
            </Text>
          )}
        </Stack>
        <Table.ScrollContainer minWidth={820} visibleFrom="sm">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Path</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Last snapshot</Table.Th>
                <Table.Th ta="right">Size</Table.Th>
                <Table.Th>Next</Table.Th>
                <Table.Th w={90} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map((s) => (
                <Table.Tr
                  key={ownerName(s.source) + s.source.path}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate({ page: "source", source: s })}
                >
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <IconFolder size={20} stroke={1.5} color="var(--mantine-color-teal-6)" />
                      <Stack gap={0}>
                        <Text size="sm" fw={600} style={{ wordBreak: "break-all" }}>
                          {s.source.path}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {ownerName(s.source)}
                        </Text>
                      </Stack>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <SourceStatus s={s} />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      <Text size="sm">{s.lastSnapshot ? relativeTime(s.lastSnapshot.startTime) : "—"}</Text>
                      <ErrorCount count={s.lastSnapshot?.errors} />
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>
                      {s.lastSnapshot ? sizeDisplayName(s.lastSnapshot.totalSize) : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={s.nextSnapshotTime ? undefined : "dimmed"} style={{ whiteSpace: "nowrap" }}>
                      {s.nextSnapshotTime ? relativeTime(s.nextSnapshotTime) : "manual"}
                    </Text>
                  </Table.Td>
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <SourceActions s={s} navigate={navigate} />
                  </Table.Td>
                </Table.Tr>
              ))}
              {visible.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="lg">
                      No sources match.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      <NewSnapshotModal opened={modalOpened} onClose={modal.close} />
    </>
  );
}
