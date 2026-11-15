import React from "react";
import { Badge, Card, Group, Loader, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconAlertTriangle, IconBan, IconCheck, IconX } from "@tabler/icons-react";

export function PageHeader({ title, description, actions }) {
  return (
    <Group justify="space-between" align="flex-end" mb="lg" gap="sm">
      <Stack gap={2}>
        <Title order={2}>{title}</Title>
        {description && (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        )}
      </Stack>
      {actions && <Group gap="xs">{actions}</Group>}
    </Group>
  );
}

export function StatCard({ label, value, hint, icon: Icon, color = "teal" }) {
  return (
    <Card>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            {label}
          </Text>
          <Text fz={{ base: 20, sm: 26 }} fw={700} lh={1.1}>
            {value}
          </Text>
          {hint && (
            <Text size="xs" c="dimmed">
              {hint}
            </Text>
          )}
        </Stack>
        {Icon && (
          <ThemeIcon variant="light" color={color} size={38} radius="md" visibleFrom="sm">
            <Icon size={20} />
          </ThemeIcon>
        )}
      </Group>
    </Card>
  );
}

export function TaskStatusBadge({ status }) {
  switch (status) {
    case "RUNNING":
      return (
        <Badge variant="light" color="blue" leftSection={<Loader size={10} color="blue" />}>
          Running
        </Badge>
      );
    case "SUCCESS":
      return (
        <Badge variant="light" color="green" leftSection={<IconCheck size={12} />}>
          Success
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="light" color="red" leftSection={<IconX size={12} />}>
          Failed
        </Badge>
      );
    case "CANCELED":
      return (
        <Badge variant="light" color="gray" leftSection={<IconBan size={12} />}>
          Canceled
        </Badge>
      );
    default:
      return <Badge variant="light">{status}</Badge>;
  }
}

export function ErrorCount({ count }) {
  if (!count) return null;
  return (
    <Badge size="xs" variant="light" color="orange" leftSection={<IconAlertTriangle size={10} />}>
      {count} {count === 1 ? "error" : "errors"}
    </Badge>
  );
}
