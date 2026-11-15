// Tasks running or recently run on the server (/tasks); /tasks/:tid opens one
// in a drawer, the same URLs as the old UI.
import React, { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ActionIcon,
  Alert,
  Card,
  Center,
  Group,
  Loader,
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { api, useTasks } from "../../../api";
import type { Task } from "../../../api";
import { formatDuration } from "../../../utils/formatutils";
import { PageHeader } from "../../components";
import { absoluteTime, relativeTime } from "../../format";
import { isRunning, TaskStatusBadge } from "./taskFormat";
import { TaskDrawer } from "./TaskDrawer";

type StatusFilter = "all" | "running" | "failed";

export function filterTasks(tasks: Task[], status: StatusFilter, kind: string | null): Task[] {
  return tasks
    .filter((t) => status === "all" || (status === "running" ? isRunning(t) : t.status === "FAILED"))
    .filter((t) => !kind || t.kind === kind)
    .sort(
      (a, b) =>
        Number(isRunning(b)) - Number(isRunning(a)) ||
        new Date(b.startTime).valueOf() - new Date(a.startTime).valueOf(),
    );
}

export function TasksPage() {
  const { tid } = useParams();
  const navigate = useNavigate();
  const tasks = useTasks();
  // Filters live in the URL (?status=running&kind=Snapshot), so links can preselect them.
  const [params, setParams] = useSearchParams();
  const statusParam = params.get("status");
  const status: StatusFilter = statusParam === "running" || statusParam === "failed" ? statusParam : "all";
  const kind = params.get("kind");
  const setFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const query = params.toString() ? "?" + params.toString() : "";
  const [canceling, setCanceling] = useState<string | null>(null);

  const all = useMemo(() => tasks.data?.tasks ?? [], [tasks.data]);
  const kinds = useMemo(() => [...new Set(all.map((t) => t.kind))].sort(), [all]);
  const visible = useMemo(() => filterTasks(all, status, kind), [all, status, kind]);
  const runningCount = all.filter(isRunning).length;
  const failedCount = all.filter((t) => t.status === "FAILED").length;

  const cancel = async (id: string) => {
    setCanceling(id);
    try {
      await api.tasks.cancel(id);
      await tasks.refresh();
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Could not cancel task",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCanceling(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Snapshots, restores and maintenance running on the server."
        actions={
          <>
            {kinds.length > 1 && (
              <Select
                size="xs"
                w={150}
                placeholder="All kinds"
                aria-label="Kind"
                data={kinds}
                value={kind}
                onChange={(v) => setFilter("kind", v)}
                clearable
                comboboxProps={{ withinPortal: true }}
              />
            )}
            <SegmentedControl
              size="xs"
              value={status}
              onChange={(v) => setFilter("status", v)}
              data={[
                { label: "All", value: "all" },
                { label: `Running${runningCount ? ` (${runningCount})` : ""}`, value: "running" },
                { label: `Failed${failedCount ? ` (${failedCount})` : ""}`, value: "failed" },
              ]}
            />
          </>
        }
      />

      {tasks.isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : tasks.error && !tasks.data ? (
        <Alert color="red" title="Could not load tasks" icon={<IconAlertTriangle />}>
          {tasks.error.message}
        </Alert>
      ) : (
        <Card padding={0}>
          <Table.ScrollContainer minWidth={640}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={130}>Status</Table.Th>
                  <Table.Th>Task</Table.Th>
                  <Table.Th>Started</Table.Th>
                  <Table.Th>Duration</Table.Th>
                  <Table.Th w={50} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((t) => (
                  <Table.Tr
                    key={t.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate("/tasks/" + encodeURIComponent(t.id) + query)}
                    data-testid="task-row"
                  >
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
                        {isRunning(t) && (
                          <>
                            <Progress value={100} size="xs" animated striped mt={4} maw={260} />
                            {t.progressInfo && (
                              <Text size="xs" c="dimmed">
                                {t.progressInfo}
                              </Text>
                            )}
                          </>
                        )}
                        {t.status === "FAILED" && t.errorMessage && (
                          <Text size="xs" c="red" lineClamp={2}>
                            {t.errorMessage}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" title={absoluteTime(t.startTime)} style={{ whiteSpace: "nowrap" }}>
                        {relativeTime(t.startTime)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace" style={{ whiteSpace: "nowrap" }}>
                        {formatDuration(t.startTime, t.endTime, true)}
                      </Text>
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      {t.status === "RUNNING" && (
                        <Tooltip label="Cancel task">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label="Cancel task"
                            loading={canceling === t.id}
                            onClick={() => void cancel(t.id)}
                          >
                            <IconX size={18} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {visible.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Group justify="center" py="lg">
                        <Text c="dimmed">{all.length ? "No tasks match the filter." : "No tasks yet."}</Text>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      <TaskDrawer id={tid ?? null} onClose={() => navigate("/tasks" + query)} />
    </>
  );
}
