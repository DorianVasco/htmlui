import React, { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  TagsInput,
  Text,
  TextInput,
} from "@mantine/core";
import { IconCalendarTime, IconFileZip, IconFilter, IconHistory, IconPlus, IconTerminal2 } from "@tabler/icons-react";
import { policies } from "../mockData";
import { PageHeader } from "../components";

function policyType(t) {
  if (!t.host && !t.userName) return { label: "Global", color: "teal" };
  if (!t.userName) return { label: "Host", color: "blue" };
  if (!t.path) return { label: "User", color: "indigo" };
  return { label: "Directory", color: "grape" };
}

function policyTarget(t) {
  if (!t.host && !t.userName) return "(global)";
  if (!t.userName) return "@" + t.host;
  if (!t.path) return t.userName + "@" + t.host;
  return t.path;
}

function PolicyEditorDrawer({ policy, onClose }) {
  return (
    <Drawer opened={!!policy} onClose={onClose} position="right" size="xl" title={policy ? `Policy · ${policyTarget(policy.target)}` : ""}>
      {policy && (
        <Stack>
          <Text size="sm" c="dimmed">
            Values left empty are inherited from the parent policy. Effective values are shown as placeholder.
          </Text>
          <Tabs defaultValue="retention">
            <Tabs.List>
              <Tabs.Tab value="retention" leftSection={<IconHistory size={16} />}>
                Retention
              </Tabs.Tab>
              <Tabs.Tab value="schedule" leftSection={<IconCalendarTime size={16} />}>
                Schedule
              </Tabs.Tab>
              <Tabs.Tab value="files" leftSection={<IconFilter size={16} />}>
                Files
              </Tabs.Tab>
              <Tabs.Tab value="compression" leftSection={<IconFileZip size={16} />}>
                Compression
              </Tabs.Tab>
              <Tabs.Tab value="actions" leftSection={<IconTerminal2 size={16} />}>
                Actions
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="retention" pt="md">
              <SimpleGrid cols={{ base: 2, sm: 3 }}>
                <NumberInput label="Latest" placeholder="10 (inherited)" />
                <NumberInput label="Hourly" placeholder="48 (inherited)" />
                <NumberInput label="Daily" placeholder="7 (inherited)" />
                <NumberInput label="Weekly" placeholder="4 (inherited)" />
                <NumberInput label="Monthly" placeholder="24 (inherited)" />
                <NumberInput label="Annual" placeholder="3 (inherited)" />
              </SimpleGrid>
            </Tabs.Panel>
            <Tabs.Panel value="schedule" pt="md">
              <Stack>
                <Select label="Snapshot frequency" placeholder="(inherited: none)" data={["every 10 minutes", "every hour", "every 3 hours", "every 12 hours", "every 24 hours"]} />
                <TagsInput label="Times of day" placeholder="e.g. 02:00" defaultValue={["02:00"]} />
                <Switch label="Run missed snapshots on startup" />
                <Card bg="var(--mantine-color-default-hover)" withBorder={false} padding="sm">
                  <Text size="xs" fw={600} mb={4}>
                    Upcoming snapshots
                  </Text>
                  <Text size="xs" c="dimmed">
                    Tomorrow 02:00 · in 2 days 02:00 · in 3 days 02:00
                  </Text>
                </Card>
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="files" pt="md">
              <Stack>
                <TagsInput label="Ignore files" defaultValue={[".git", "node_modules", "*.tmp"]} />
                <TextInput label="Ignore rules file" placeholder=".kopiaignore (inherited)" />
                <NumberInput label="Ignore files larger than (MB)" placeholder="no limit (inherited)" />
                <Switch label="Ignore cache directories" defaultChecked />
                <Switch label="Scan only one filesystem" />
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="compression" pt="md">
              <Stack>
                <Select label="Compression algorithm" placeholder="zstd (inherited)" data={["none", "zstd", "zstd-fastest", "zstd-better-compression", "s2-default", "pgzip"]} />
                <TagsInput label="Never compress extensions" defaultValue={[".jpg", ".mp4", ".zip"]} />
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="actions" pt="md">
              <Stack>
                <TextInput label="Before snapshot" placeholder="script path" />
                <TextInput label="After snapshot" placeholder="script path" />
                <Select label="Mode" data={["essential", "optional", "async"]} defaultValue="essential" />
              </Stack>
            </Tabs.Panel>
          </Tabs>
          <Group justify="space-between" mt="md">
            <Button variant="subtle" color="red">
              Delete policy
            </Button>
            <Group gap="xs">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={onClose}>Save</Button>
            </Group>
          </Group>
        </Stack>
      )}
    </Drawer>
  );
}

export function PoliciesPage() {
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader
        title="Policies"
        description="Retention, scheduling and file rules. More specific policies override broader ones."
        actions={<Button leftSection={<IconPlus size={16} />}>New policy</Button>}
      />
      <Card padding={0}>
        <Table.ScrollContainer minWidth={640}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={120}>Type</Table.Th>
                <Table.Th>Target</Table.Th>
                <Table.Th>Defines</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {policies.map((p) => {
                const type = policyType(p.target);
                return (
                  <Table.Tr key={policyTarget(p.target) + p.target.host} style={{ cursor: "pointer" }} onClick={() => setEditing(p)}>
                    <Table.Td>
                      <Badge variant="light" color={type.color}>
                        {type.label}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" fw={600} style={{ wordBreak: "break-all" }}>
                          {policyTarget(p.target)}
                        </Text>
                        {p.target.path && (
                          <Text size="xs" c="dimmed">
                            {p.target.userName}@{p.target.host}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {p.summary}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <PolicyEditorDrawer policy={editing} onClose={() => setEditing(null)} />
    </>
  );
}
