import React from "react";
import {
  Button,
  Card,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  useMantineColorScheme,
} from "@mantine/core";
import { IconBell, IconPlus } from "@tabler/icons-react";
import { PageHeader } from "../components";

function Row({ label, hint, children }) {
  return (
    <Group justify="space-between" wrap="wrap" gap="sm" py="xs">
      <Stack gap={0}>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        {hint && (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        )}
      </Stack>
      {children}
    </Group>
  );
}

export function PreferencesPage() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <>
      <PageHeader title="Preferences" description="Stored on the Kopia server (ui-preferences)." />
      <Stack maw={720}>
        <Card>
          <Text fw={600} mb="xs">
            Appearance
          </Text>
          <Row label="Theme">
            <SegmentedControl
              size="xs"
              value={colorScheme}
              onChange={setColorScheme}
              data={[
                { label: "Auto", value: "auto" },
                { label: "Light", value: "light" },
                { label: "Dark", value: "dark" },
              ]}
            />
          </Row>
          <Row label="Font size">
            <SegmentedControl size="xs" defaultValue="md" data={["sm", "md", "lg"]} />
          </Row>
          <Row label="Byte representation" hint="1 KB = 1000 B or 1 KiB = 1024 B">
            <SegmentedControl
              size="xs"
              defaultValue="10"
              data={[
                { label: "Base 10", value: "10" },
                { label: "Base 2", value: "2" },
              ]}
            />
          </Row>
          <Row label="Rows per page">
            <Select w={100} size="xs" defaultValue="20" data={["10", "20", "50", "100"]} />
          </Row>
          <Row label="Show CLI equivalents">
            <Switch />
          </Row>
        </Card>
        <Card>
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Notifications</Text>
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}>
              Add profile
            </Button>
          </Group>
          <Group gap="sm" c="dimmed">
            <IconBell size={18} />
            <Text size="sm">No notification profiles yet. Add email, Pushover or a webhook.</Text>
          </Group>
        </Card>
      </Stack>
    </>
  );
}
