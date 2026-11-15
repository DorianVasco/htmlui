import React, { useState } from "react";
import { ActionIcon, Card, Code, Drawer, Group, Progress, SegmentedControl, Stack, Table, Text, Tooltip } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { tasks } from "../mockData";
import { PageHeader, TaskStatusBadge } from "../components";
import { formatDuration, relativeTime } from "../format";

const sampleLog = `12:04:11 INFO  snapshot started
12:04:11 INFO  using policy: global + me@workstation
12:04:12 INFO  estimated 26 400 files, 11.2 GB
12:05:40 INFO  hashed 9 812 files (4.1 GB)
12:07:02 WARN  skipping locked file: ~$report.docx
12:08:15 INFO  hashed 18 200 files (7.4 GB)`;

export function TasksPage() {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);

  const visible = tasks.filter((t) => filter === "all" || (filter === "running" ? t.status === "RUNNING" : t.status === "FAILED"));

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Snapshots, restores and maintenance running on the server."
        actions={
          <SegmentedControl
            size="xs"
            value={filter}
            onChange={setFilter}
            data={[
              { label: "All", value: "all" },
              { label: "Running", value: "running" },
              { label: "Failed", value: "failed" },
            ]}
          />
        }
      />
      <Card padding={0}>
        <Table.ScrollContainer minWidth={720}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Status</Table.Th>
                <Table.Th>Task</Table.Th>
                <Table.Th>Started</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th w={50} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map((t) => (
                <Table.Tr key={t.id} style={{ cursor: "pointer" }} onClick={() => setOpen(t)}>
                  <Table.Td>
                    <TaskStatusBadge status={t.status} />
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm" fw={500}>
                        {t.kind}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
                        {t.description}
                      </Text>
                      {t.status === "RUNNING" && <Progress value={t.progress} size="xs" animated mt={4} maw={260} />}
                      {t.error && (
                        <Text size="xs" c="red">
                          {t.error}
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{relativeTime(t.startTime)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {formatDuration(t.startTime, t.endTime, true)}
                    </Text>
                  </Table.Td>
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    {t.status === "RUNNING" && (
                      <Tooltip label="Cancel task">
                        <ActionIcon variant="subtle" color="red" aria-label="Cancel task">
                          <IconX size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      <Drawer opened={!!open} onClose={() => setOpen(null)} position="right" size="lg" title={open ? `${open.kind} · ${open.id}` : ""}>
        {open && (
          <Stack>
            <Group>
              <TaskStatusBadge status={open.status} />
              <Text size="sm" c="dimmed">
                {new Date(open.startTime).toLocaleString()}
              </Text>
            </Group>
            <Text size="sm">{open.description}</Text>
            <Text fw={600} size="sm">
              Log
            </Text>
            <Code block style={{ fontSize: 12 }}>
              {sampleLog}
            </Code>
          </Stack>
        )}
      </Drawer>
    </>
  );
}
