// Notification profiles: where Kopia sends reports (e-mail, Pushover, webhook)
// and from which severity on. Same API and config fields as the old UI.
import React, { useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  NumberInput,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconBell,
  IconCopy,
  IconDots,
  IconMail,
  IconPencil,
  IconPlus,
  IconSend,
  IconTrash,
  IconWebhook,
} from "@tabler/icons-react";
import { api, useApi } from "../../../api";
import type { NotificationProfile } from "../../../api";

export const NOTIFICATION_METHODS: Record<
  string,
  { label: string; icon: typeof IconMail; defaults: Record<string, unknown>; required: string[] }
> = {
  email: {
    label: "E-mail",
    icon: IconMail,
    defaults: { smtpPort: 587, format: "txt" },
    required: ["smtpServer", "smtpPort", "from", "to"],
  },
  pushover: { label: "Pushover", icon: IconBell, defaults: { format: "txt" }, required: ["appToken", "userKey"] },
  webhook: { label: "Webhook", icon: IconWebhook, defaults: { format: "txt", method: "POST" }, required: ["endpoint"] },
};

export const SEVERITIES = [
  { value: "-100", label: "Verbose" },
  { value: "-10", label: "Success" },
  { value: "0", label: "Report" },
  { value: "10", label: "Warning" },
  { value: "20", label: "Error" },
];

export const severityLabel = (s: number | undefined) =>
  SEVERITIES.find((o) => Number(o.value) === (s ?? 0))?.label ?? "Unknown";

/** First free name like "email-1", "email-2", … */
export function newProfileName(type: string, existing: NotificationProfile[]): string {
  for (let i = 1; ; i++) {
    const name = `${type}-${i}`;
    if (!existing.some((p) => p.profile === name)) return name;
  }
}

/** Names of required config fields that are empty. */
export function missingFields(p: NotificationProfile): string[] {
  const m = NOTIFICATION_METHODS[p.method.type];
  return (m?.required ?? []).filter((k) => {
    const v = p.method.config[k];
    return v === undefined || v === null || String(v).trim() === "";
  });
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

function MethodFields({
  profile,
  onChange,
  invalid,
}: {
  profile: NotificationProfile;
  onChange: (config: Record<string, unknown>) => void;
  invalid: string[];
}) {
  const c = profile.method.config;
  const str = (k: string) => (c[k] === undefined || c[k] === null ? "" : String(c[k]));
  const text = (k: string, label: string, props: Record<string, unknown> = {}) => (
    <TextInput
      label={label}
      value={str(k)}
      onChange={(e) => onChange({ ...c, [k]: e.currentTarget.value })}
      required={NOTIFICATION_METHODS[profile.method.type].required.includes(k)}
      error={invalid.includes(k) ? "Required" : undefined}
      {...props}
    />
  );
  const format = (
    <Select
      label="Format"
      data={[
        { value: "txt", label: "Plain text" },
        { value: "html", label: "HTML" },
      ]}
      value={str("format") || "txt"}
      onChange={(v) => onChange({ ...c, format: v ?? "txt" })}
      allowDeselect={false}
      comboboxProps={{ withinPortal: true }}
    />
  );

  switch (profile.method.type) {
    case "email":
      return (
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
            <div style={{ gridColumn: "span 2" }}>
              {text("smtpServer", "SMTP server", { placeholder: "smtp.example.com" })}
            </div>
            <NumberInput
              label="Port"
              required
              value={typeof c.smtpPort === "number" ? c.smtpPort : str("smtpPort")}
              onChange={(v) => onChange({ ...c, smtpPort: typeof v === "number" ? v : undefined })}
              error={invalid.includes("smtpPort") ? "Required" : undefined}
              min={1}
              max={65535}
              hideControls
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            {text("smtpUsername", "Username", { placeholder: "often the e-mail address" })}
            <PasswordInput
              label="Password"
              value={str("smtpPassword")}
              onChange={(e) => onChange({ ...c, smtpPassword: e.currentTarget.value })}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            {text("from", "From", { placeholder: "kopia@example.com" })}
            {text("to", "To", { placeholder: "comma-separated addresses" })}
            {text("cc", "CC", { placeholder: "optional" })}
            {text("smtpIdentity", "SMTP identity", { placeholder: "usually empty" })}
          </SimpleGrid>
          {format}
        </Stack>
      );
    case "pushover":
      return (
        <Stack gap="sm">
          {text("appToken", "App token")}
          {text("userKey", "User or group key")}
          {format}
        </Stack>
      );
    case "webhook":
      return (
        <Stack gap="sm">
          {text("endpoint", "URL", { placeholder: "https://…" })}
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <Select
              label="HTTP method"
              data={["POST", "PUT"]}
              value={str("method") || "POST"}
              onChange={(v) => onChange({ ...c, method: v ?? "POST" })}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
            />
            {format}
          </SimpleGrid>
          <Textarea
            label="Additional headers"
            description="One per line, as “Header: Value”."
            autosize
            minRows={2}
            value={str("headers")}
            onChange={(e) => onChange({ ...c, headers: e.currentTarget.value })}
          />
        </Stack>
      );
    default:
      return <Alert color="yellow">Unknown notification method “{profile.method.type}”.</Alert>;
  }
}

function ProfileModal({
  editing,
  existing,
  onClose,
  onSaved,
}: {
  editing: { profile: NotificationProfile; isNew: boolean } | null;
  existing: NotificationProfile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Modal
      opened={!!editing}
      onClose={onClose}
      title={editing?.isNew ? "New notification profile" : "Edit notification profile"}
      size="lg"
      centered
    >
      {editing && (
        <ProfileForm
          key={editing.profile.profile}
          initial={editing.profile}
          isNew={editing.isNew}
          existing={existing}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

function ProfileForm({
  initial,
  isNew,
  existing,
  onClose,
  onSaved,
}: {
  initial: NotificationProfile;
  isNew: boolean;
  existing: NotificationProfile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [p, setP] = useState<NotificationProfile>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [error, setError] = useState<{ kind: "save" | "test"; message: string } | null>(null);

  const missing = missingFields(p);
  const nameTaken = isNew && existing.some((e) => e.profile === p.profile.trim());
  const nameError = !p.profile.trim() ? "Required" : nameTaken ? "A profile with this name exists" : undefined;
  const valid = !missing.length && !nameError;

  const run = async (kind: "save" | "test") => {
    setShowErrors(true);
    setError(null);
    if (!valid) return;
    setBusy(kind);
    const profile = { ...p, profile: p.profile.trim() };
    try {
      if (kind === "test") {
        await api.notifications.test(profile);
        notifications.show({ color: "green", title: "Test notification sent", message: "Check that it arrived." });
      } else {
        await api.notifications.save(profile);
        onSaved();
        onClose();
      }
    } catch (err) {
      setError({ kind, message: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void run("save");
      }}
    >
      <Stack>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <TextInput
            label="Profile name"
            value={p.profile}
            onChange={(e) => setP({ ...p, profile: e.currentTarget.value })}
            readOnly={!isNew}
            required
            error={showErrors ? nameError : undefined}
          />
          <Select
            label="Minimum severity"
            description="Send only notifications at least this important."
            data={SEVERITIES}
            value={String(p.minSeverity ?? 0)}
            onChange={(v) => setP({ ...p, minSeverity: Number(v ?? 0) })}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
        </SimpleGrid>
        <MethodFields
          profile={p}
          onChange={(config) => setP({ ...p, method: { ...p.method, config } })}
          invalid={showErrors ? missing : []}
        />
        {error && (
          <Alert color="red" title={error.kind === "test" ? "Sending failed" : "Could not save"}>
            {error.message}
          </Alert>
        )}
        <Group justify="space-between">
          <Button
            variant="default"
            leftSection={<IconSend size={16} />}
            loading={busy === "test"}
            onClick={() => void run("test")}
          >
            Send test
          </Button>
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy === "save"}>
              {isNew ? "Create profile" : "Save"}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}

export function NotificationProfiles() {
  const list = useApi((signal) => api.notifications.list({ signal }), []);
  const profiles = list.data ?? [];
  const [editing, setEditing] = useState<{ profile: NotificationProfile; isNew: boolean } | null>(null);
  const [deleting, setDeleting] = useState<NotificationProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const create = (type: string) =>
    setEditing({
      isNew: true,
      profile: {
        profile: newProfileName(type, profiles),
        method: { type, config: { ...NOTIFICATION_METHODS[type].defaults } },
        minSeverity: 0,
      },
    });
  const duplicate = (p: NotificationProfile) =>
    setEditing({
      isNew: true,
      profile: {
        ...p,
        profile: newProfileName(p.method.type, profiles),
        method: { ...p.method, config: { ...p.method.config } },
      },
    });

  const test = async (p: NotificationProfile) => {
    try {
      await api.notifications.test(p);
      notifications.show({
        color: "green",
        title: "Test notification sent",
        message: `Check that “${p.profile}” arrived.`,
      });
    } catch (err) {
      notifications.show({ color: "red", title: "Sending failed", message: errorText(err) });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.notifications.delete(deleting.profile);
      await list.refresh();
      setDeleting(null);
    } catch (err) {
      notifications.show({ color: "red", title: "Could not delete", message: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding={0}>
      <Group p="md" justify="space-between">
        <div>
          <Text fw={600}>Notifications</Text>
          <Text size="xs" c="dimmed">
            Get snapshot reports and errors by e-mail, Pushover or a webhook.
          </Text>
        </div>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />}>
              Add profile
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {Object.entries(NOTIFICATION_METHODS).map(([type, m]) => (
              <Menu.Item key={type} leftSection={<m.icon size={16} />} onClick={() => create(type)}>
                {m.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>

      {list.error && !list.data ? (
        <Alert color="red" m="md" title="Could not load notification profiles">
          {list.error.message}
        </Alert>
      ) : profiles.length === 0 ? (
        <Group gap="sm" c="dimmed" px="md" pb="md">
          <IconBell size={18} />
          <Text size="sm">
            {list.isLoading
              ? "Loading…"
              : "No notification profiles yet. Without one, Kopia doesn't tell you when snapshots fail."}
          </Text>
        </Group>
      ) : (
        <Table.ScrollContainer minWidth={480}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Profile</Table.Th>
                <Table.Th>Method</Table.Th>
                <Table.Th>From severity</Table.Th>
                <Table.Th w={90} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {profiles.map((p) => {
                const m = NOTIFICATION_METHODS[p.method.type];
                return (
                  <Table.Tr key={p.profile} data-testid="notification-profile">
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {p.profile}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        {m && <m.icon size={16} />}
                        <Text size="sm">{m?.label ?? p.method.type}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={(p.minSeverity ?? 0) >= 10 ? "orange" : "gray"} tt="none">
                        {severityLabel(p.minSeverity)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          aria-label={`Edit ${p.profile}`}
                          onClick={() => setEditing({ profile: p, isNew: false })}
                        >
                          <IconPencil size={18} />
                        </ActionIcon>
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" aria-label={`More actions for ${p.profile}`}>
                              <IconDots size={18} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconSend size={16} />} onClick={() => void test(p)}>
                              Send test
                            </Menu.Item>
                            <Menu.Item leftSection={<IconCopy size={16} />} onClick={() => duplicate(p)}>
                              Duplicate
                            </Menu.Item>
                            <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => setDeleting(p)}>
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <ProfileModal
        editing={editing}
        existing={profiles}
        onClose={() => setEditing(null)}
        onSaved={() => void list.refresh()}
      />
      <Modal opened={!!deleting} onClose={() => setDeleting(null)} title="Delete notification profile?" centered>
        <Stack>
          <Text size="sm">“{deleting?.profile}” will no longer receive notifications.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button color="red" loading={busy} onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
