import React from "react";
import { ActionIcon, Badge, Button, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconFolder, IconTrash } from "@tabler/icons-react";
import { relativeTime } from "../../format";
import { forgetRepo, KnownRepo } from "../../knownRepos";

/** Remembered repositories with Switch/Connect and Forget actions. */
export function KnownRepositoriesList({
  repos,
  currentId,
  actionLabel,
  onSelect,
}: {
  repos: KnownRepo[];
  currentId?: string;
  actionLabel: string;
  onSelect: (repo: KnownRepo) => void;
}) {
  if (!repos.length) return null;
  return (
    <Card padding={0}>
      <Stack gap={0}>
        {repos.map((r, i) => {
          const isCurrent = r.id === currentId;
          return (
            <Group
              key={r.id}
              justify="space-between"
              wrap="nowrap"
              px="md"
              py="sm"
              gap="sm"
              style={i ? { borderTop: "1px solid var(--mantine-color-default-border)" } : undefined}
              data-testid="known-repo"
            >
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <IconFolder
                  size={20}
                  stroke={1.5}
                  color="var(--mantine-primary-color-filled)"
                  style={{ flexShrink: 0 }}
                />
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Group gap={6}>
                    <Text size="sm" fw={600}>
                      {r.description || "Unnamed repository"}
                    </Text>
                    {isCurrent && (
                      <Badge size="xs" variant="light" color="green">
                        Current
                      </Badge>
                    )}
                    {r.clientOptions.readonly && (
                      <Badge size="xs" variant="light" color="yellow">
                        Read-only
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
                    {r.storage.config.path}
                  </Text>
                  <Text size="xs" c="dimmed">
                    as {r.clientOptions.username}@{r.clientOptions.hostname} · last used {relativeTime(r.lastConnected)}
                  </Text>
                </Stack>
              </Group>
              <Group gap={4} wrap="nowrap">
                {!isCurrent && (
                  <Button size="xs" variant="light" onClick={() => onSelect(r)}>
                    {actionLabel}
                  </Button>
                )}
                <Tooltip label="Forget (removes it from this list only)">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Forget ${r.description}`}
                    onClick={() => forgetRepo(r.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          );
        })}
      </Stack>
    </Card>
  );
}
