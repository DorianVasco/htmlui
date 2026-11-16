// Preferences (/preferences): appearance and notification profiles.
import React, { ReactNode, useState } from "react";
import { Card, Group, SegmentedControl, Stack, Switch, Text, useMantineColorScheme } from "@mantine/core";
import type { MantineColorScheme } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { PageHeader } from "../../components";
import { sizeDisplayName } from "../../format";
import { usePreferences } from "../../preferences";
import { useRepoStatusContext } from "../../repoStatus";
import { setShowCli, useShowCli } from "../../cli";
import { NotificationProfiles } from "./NotificationProfiles";

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <Group justify="space-between" wrap="wrap" gap="sm" py="xs">
      <Stack gap={0} style={{ flex: "1 1 240px" }}>
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
  const prefs = usePreferences();
  const showCli = useShowCli();
  const connected = !!useRepoStatusContext().data?.connected;
  const [saving, setSaving] = useState(false);

  const save = async (changes: Parameters<typeof prefs.save>[0]) => {
    setSaving(true);
    try {
      await prefs.save(changes);
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Could not save preferences",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Preferences" description="Settings for this user interface and for notifications." />
      <Stack maw={760}>
        <Card>
          <Text fw={600} mb="xs">
            Appearance
          </Text>
          <Row label="Theme" hint="Stored in this browser.">
            <SegmentedControl
              size="xs"
              value={colorScheme}
              onChange={(v) => setColorScheme(v as MantineColorScheme)}
              data={[
                { label: "Auto", value: "auto" },
                { label: "Light", value: "light" },
                { label: "Dark", value: "dark" },
              ]}
              aria-label="Theme"
            />
          </Row>
          <Row
            label="Sizes"
            hint={`For example ${sizeDisplayName(1536000, prefs.bytesStringBase2)}. Stored on the server.`}
          >
            <SegmentedControl
              size="xs"
              value={prefs.bytesStringBase2 ? "2" : "10"}
              onChange={(v) => void save({ bytesStringBase2: v === "2" })}
              disabled={!prefs.loaded || saving}
              data={[
                { label: "1 KB = 1000 bytes", value: "10" },
                { label: "1 KiB = 1024 bytes", value: "2" },
              ]}
              aria-label="Sizes"
            />
          </Row>
          <Row
            label="Show all users' snapshots"
            hint="When the server holds snapshots of several users or computers, list all of them by default."
          >
            <Switch
              checked={prefs.defaultSnapshotViewAll}
              onChange={(e) => void save({ defaultSnapshotViewAll: e.currentTarget.checked })}
              disabled={!prefs.loaded || saving}
              aria-label="Show all users' snapshots"
            />
          </Row>
          <Row
            label="Show CLI equivalents"
            hint="Show the kopia command line for what a page does. Stored in this browser."
          >
            <Switch
              checked={showCli}
              onChange={(e) => setShowCli(e.currentTarget.checked)}
              aria-label="Show CLI equivalents"
            />
          </Row>
        </Card>
        {connected ? (
          <NotificationProfiles />
        ) : (
          <Card>
            <Text fw={600}>Notifications</Text>
            <Text size="sm" c="dimmed">
              Notification profiles are stored in the repository. Connect to a repository to manage them.
            </Text>
          </Card>
        )}
      </Stack>
    </>
  );
}
