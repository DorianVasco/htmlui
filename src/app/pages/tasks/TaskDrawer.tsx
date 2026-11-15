// Details of one task: status, timing, counters and its log, which follows
// along while the task runs.
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Center,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Switch,
  Table,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { api, useTask, useTaskLogs } from "../../../api";
import type { Task } from "../../../api";
import { formatDuration } from "../../../utils/formatutils";
import { absoluteTime } from "../../format";
import { usePreferences } from "../../preferences";
import { counterRows, isRunning, logLevelColor, logParams, logTime, TaskStatusBadge } from "./taskFormat";

function TaskLog({ id, running }: { id: string; running: boolean }) {
  const logs = useTaskLogs(id, { follow: running });
  const [follow, setFollow] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const entries = logs.data?.logs ?? [];

  // Keep the newest line in view while following.
  useEffect(() => {
    if (follow && viewportRef.current) viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [entries.length, follow]);

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600} size="sm">
          Log
        </Text>
        {running && (
          <Switch size="xs" label="Follow" checked={follow} onChange={(e) => setFollow(e.currentTarget.checked)} />
        )}
      </Group>
      {logs.isLoading ? (
        <Center py="md">
          <Loader size="sm" />
        </Center>
      ) : logs.error && !logs.data ? (
        <Alert color="red">{logs.error.message}</Alert>
      ) : entries.length === 0 ? (
        <Text size="sm" c="dimmed">
          No log entries.
        </Text>
      ) : (
        <ScrollArea.Autosize mah="50vh" viewportRef={viewportRef} type="auto">
          <Box
            ff="monospace"
            fz={12}
            p="xs"
            bg="var(--mantine-color-default-hover)"
            style={{ borderRadius: "var(--mantine-radius-sm)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
            data-testid="task-log"
          >
            {entries.map((e, i) => {
              const params = logParams(e);
              return (
                <div
                  // The log only grows at the end and entries can repeat, so the position is a stable key.
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  key={i}
                  style={{
                    color: logLevelColor(e.level) ? `var(--mantine-color-${logLevelColor(e.level)}-text)` : undefined,
                    fontWeight: e.level >= 1 ? 600 : undefined,
                  }}
                >
                  <span title={new Date(e.ts * 1000).toLocaleString()} style={{ opacity: 0.6 }}>
                    {logTime(e.ts)}
                  </span>{" "}
                  {e.msg}
                  {params && <span style={{ opacity: 0.6 }}> {params}</span>}
                </div>
              );
            })}
          </Box>
        </ScrollArea.Autosize>
      )}
    </Stack>
  );
}

function TaskDetails({ task }: { task: Task }) {
  const { bytesStringBase2: base2 } = usePreferences();
  const [canceling, setCanceling] = useState(false);
  const running = isRunning(task);
  const counters = counterRows(task.counters, base2);

  const cancel = async () => {
    setCanceling(true);
    try {
      await api.tasks.cancel(task.id);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Could not cancel task",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCanceling(false);
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="sm">
          <TaskStatusBadge status={task.status} />
          <Text size="sm" c="dimmed">
            {absoluteTime(task.startTime)} · {formatDuration(task.startTime, task.endTime, true)}
          </Text>
        </Group>
        {task.status === "RUNNING" && (
          <Button
            size="xs"
            color="red"
            variant="light"
            leftSection={<IconX size={14} />}
            loading={canceling}
            onClick={() => void cancel()}
          >
            Cancel task
          </Button>
        )}
      </Group>
      <Text size="sm" style={{ wordBreak: "break-all" }}>
        {task.description}
      </Text>
      {running && task.progressInfo && (
        <Text size="sm" c="dimmed">
          {task.progressInfo}
        </Text>
      )}
      {task.status === "FAILED" && task.errorMessage && (
        <Alert color="red" icon={<IconAlertTriangle />} title="Task failed">
          {task.errorMessage}
        </Alert>
      )}
      {counters.length > 0 && (
        <Table withRowBorders={false} verticalSpacing={4}>
          <Table.Tbody>
            {counters.map((c) => (
              <Table.Tr key={c.label}>
                <Table.Td>
                  <Text size="sm" c={c.level === "error" ? "red" : c.level === "warning" ? "orange" : undefined}>
                    {c.label}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="sm" ff="monospace">
                    {c.value}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <TaskLog id={task.id} running={running} />
    </Stack>
  );
}

export function TaskDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const task = useTask(id);
  return (
    <Drawer
      opened={!!id}
      onClose={onClose}
      position="right"
      size="xl"
      title={task.data ? `${task.data.kind} · task ${task.data.id}` : "Task"}
    >
      {task.data ? (
        <TaskDetails key={task.data.id} task={task.data} />
      ) : task.error ? (
        <Alert color="red" title="Could not load task">
          {task.error.message}
        </Alert>
      ) : (
        <Center py="xl">
          <Loader />
        </Center>
      )}
    </Drawer>
  );
}
