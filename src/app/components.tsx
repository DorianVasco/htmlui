import React, { ReactNode } from "react";
import { Card, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import type { Icon } from "@tabler/icons-react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
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

export function StatCard({
  label,
  value,
  hint,
  icon: IconComponent,
  color,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: Icon;
  color?: string;
}) {
  return (
    <Card>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">
            {label}
          </Text>
          <Text fz={{ base: 20, sm: 26 }} fw={700} lh={1.1}>
            {value}
          </Text>
          {hint && (
            <Text size="xs" c="dimmed" truncate>
              {hint}
            </Text>
          )}
        </Stack>
        {IconComponent && (
          <ThemeIcon variant="light" color={color} size={38} radius="md" visibleFrom="sm">
            <IconComponent size={20} />
          </ThemeIcon>
        )}
      </Group>
    </Card>
  );
}
