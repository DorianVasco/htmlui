import React from "react";
import { Badge, Button, Card, Group, SimpleGrid, Stack, Table, Text, TextInput, ThemeIcon } from "@mantine/core";
import { IconCloud, IconPlugConnectedX, IconTerminal2 } from "@tabler/icons-react";
import { repoStatus } from "../mockData";
import { PageHeader } from "../components";
import { sizeDisplayName } from "../format";

const rows = [
  ["Config file", repoStatus.configFile],
  ["Storage", repoStatus.storageDetails],
  ["Hash", repoStatus.hash],
  ["Encryption", repoStatus.encryption],
  ["Splitter", repoStatus.splitter],
  ["Format version", repoStatus.formatVersion],
  ["Error correction", repoStatus.eccOverheadPercent ? repoStatus.eccOverheadPercent + "%" : "disabled"],
  ["Connected as", repoStatus.username + "@" + repoStatus.hostname],
];

export function RepositoryPage() {
  return (
    <>
      <PageHeader
        title="Repository"
        description="Where your snapshots are stored."
        actions={
          <Button color="red" variant="light" leftSection={<IconPlugConnectedX size={16} />}>
            Disconnect
          </Button>
        }
      />
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Card style={{ gridColumn: "span 1" }}>
          <Stack align="flex-start">
            <ThemeIcon size={48} radius="md" variant="light">
              <IconCloud size={28} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text fw={700} size="lg">
                Amazon S3
              </Text>
              <Text size="sm" c="dimmed">
                {repoStatus.storageDetails}
              </Text>
            </Stack>
            <Group gap="xs">
              <Badge variant="dot" color="green">
                Connected
              </Badge>
              {repoStatus.readonly && <Badge color="yellow">Read-only</Badge>}
            </Group>
            <Text size="sm">
              Total stored: <b>{sizeDisplayName(repoStatus.totalSize)}</b>
            </Text>
            <TextInput label="Description" defaultValue={repoStatus.description} w="100%" />
            <Button size="xs" variant="default">
              Save description
            </Button>
          </Stack>
        </Card>
        <Card style={{ gridColumn: "span 2" }} padding={0}>
          <Table>
            <Table.Tbody>
              {rows.map(([k, v]) => (
                <Table.Tr key={k}>
                  <Table.Td w={180}>
                    <Text size="sm" c="dimmed">
                      {k}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace" style={{ wordBreak: "break-all" }}>
                      {v}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group p="md">
            <Button size="xs" variant="subtle" leftSection={<IconTerminal2 size={14} />}>
              Show CLI equivalent
            </Button>
          </Group>
        </Card>
      </SimpleGrid>
    </>
  );
}
