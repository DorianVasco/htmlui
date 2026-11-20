// Network limits (throttling) of the connected repository: GET/PUT repo/throttle.
// The server applies them right away and also saves them in the repository config,
// so they survive restarts. Not available for repositories reached through a Kopia
// server (the API answers STORAGE_CONNECTION).
import React, { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Collapse,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronDown, IconChevronRight, IconGauge } from "@tabler/icons-react";
import { api, ApiError, useApi } from "../../../api";
import type { ThrottleLimits } from "../../../api";
import { usePreferences } from "../../preferences";

export type RateUnit = "k" | "M";

const factor = (unit: RateUnit, base2: boolean) => (unit === "M" ? (base2 ? 1024 * 1024 : 1e6) : base2 ? 1024 : 1000);

export const unitLabel = (unit: RateUnit, base2: boolean) =>
  unit === "M" ? (base2 ? "MiB/s" : "MB/s") : base2 ? "KiB/s" : "KB/s";

/** Splits bytes per second into an amount and a unit for the form (MB/s from 1 MB/s on). */
export function splitRate(bytesPerSecond: number | undefined, base2: boolean): { amount: number | ""; unit: RateUnit } {
  if (!bytesPerSecond || bytesPerSecond <= 0) return { amount: "", unit: "M" };
  const unit: RateUnit = bytesPerSecond >= factor("M", base2) ? "M" : "k";
  return { amount: Math.round((bytesPerSecond / factor(unit, base2)) * 100) / 100, unit };
}

export function rateToBytes(amount: number | "", unit: RateUnit, base2: boolean): number | undefined {
  return typeof amount === "number" && amount > 0 ? Math.round(amount * factor(unit, base2)) : undefined;
}

/** "5 MB/s" or "unlimited". */
export function formatRate(bytesPerSecond: number | undefined, base2: boolean): string {
  const { amount, unit } = splitRate(bytesPerSecond, base2);
  return amount === "" ? "unlimited" : `${amount} ${unitLabel(unit, base2)}`;
}

const ADVANCED: { key: keyof ThrottleLimits; label: string; integer?: boolean }[] = [
  { key: "readsPerSecond", label: "Reads per second" },
  { key: "writesPerSecond", label: "Writes per second" },
  { key: "listsPerSecond", label: "Lists per second" },
  { key: "concurrentReads", label: "Concurrent reads", integer: true },
  { key: "concurrentWrites", label: "Concurrent writes", integer: true },
];

/** Short description for the card, e.g. "Upload 5 MB/s · Download unlimited · 2 more limits". */
export function limitsSummary(l: ThrottleLimits | undefined, base2: boolean): string {
  const up = l?.maxUploadSpeedBytesPerSecond;
  const down = l?.maxDownloadSpeedBytesPerSecond;
  const more = ADVANCED.filter((f) => (l?.[f.key] ?? 0) > 0).length;
  if (!up && !down && !more) return "No limits: Kopia uses the full connection speed.";
  return [
    `Upload ${formatRate(up, base2)}`,
    `Download ${formatRate(down, base2)}`,
    ...(more ? [`${more} more ${more === 1 ? "limit" : "limits"}`] : []),
  ].join(" · ");
}

/** Only positive values; the server treats omitted fields as unlimited. */
export function cleanLimits(l: ThrottleLimits): ThrottleLimits {
  return Object.fromEntries(Object.entries(l).filter(([, v]) => typeof v === "number" && v > 0)) as ThrottleLimits;
}

function RateField({
  label,
  value,
  onChange,
  base2,
}: {
  label: string;
  value: { amount: number | ""; unit: RateUnit };
  onChange: (v: { amount: number | ""; unit: RateUnit }) => void;
  base2: boolean;
}) {
  return (
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <NumberInput
        label={label}
        placeholder="unlimited"
        value={value.amount}
        onChange={(v) => onChange({ ...value, amount: typeof v === "number" ? v : "" })}
        min={0}
        decimalScale={2}
        style={{ flex: 1 }}
      />
      <Select
        aria-label={`${label} unit`}
        data={(["k", "M"] as RateUnit[]).map((u) => ({ value: u, label: unitLabel(u, base2) }))}
        value={value.unit}
        onChange={(u) => onChange({ ...value, unit: (u as RateUnit) ?? "M" })}
        allowDeselect={false}
        w={100}
        comboboxProps={{ withinPortal: true }}
      />
    </Group>
  );
}

function LimitsForm({
  initial,
  base2,
  onClose,
  onSaved,
}: {
  initial: ThrottleLimits;
  base2: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [upload, setUpload] = useState(() => splitRate(initial.maxUploadSpeedBytesPerSecond, base2));
  const [download, setDownload] = useState(() => splitRate(initial.maxDownloadSpeedBytesPerSecond, base2));
  const [advanced, setAdvanced] = useState<ThrottleLimits>(
    Object.fromEntries(ADVANCED.map((f) => [f.key, initial[f.key]])) as ThrottleLimits,
  );
  const [showAdvanced, setShowAdvanced] = useState(ADVANCED.some((f) => (initial[f.key] ?? 0) > 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limits = cleanLimits({
    ...advanced,
    maxUploadSpeedBytesPerSecond: rateToBytes(upload.amount, upload.unit, base2),
    maxDownloadSpeedBytesPerSecond: rateToBytes(download.amount, download.unit, base2),
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.repo.setThrottle(limits);
      notifications.show({ color: "green", message: "Network limits saved" });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    setUpload({ amount: "", unit: upload.unit });
    setDownload({ amount: "", unit: download.unit });
    setAdvanced({});
  };

  return (
    <form onSubmit={(e) => void save(e)} noValidate>
      <Stack>
        <Text size="sm" c="dimmed">
          Leave a field empty for no limit. Changes apply right away, also to snapshots that are running, and are kept
          after a restart.
        </Text>
        <Stack gap="sm">
          <RateField label="Upload limit" value={upload} onChange={setUpload} base2={base2} />
          <RateField label="Download limit" value={download} onChange={setDownload} base2={base2} />
        </Stack>
        <UnstyledButton onClick={() => setShowAdvanced((a) => !a)}>
          <Group gap={4}>
            {showAdvanced ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            <Text size="sm" c="dimmed">
              Advanced
            </Text>
          </Group>
        </UnstyledButton>
        <Collapse expanded={showAdvanced}>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            {ADVANCED.map((f) => (
              <NumberInput
                key={f.key}
                label={f.label}
                placeholder="unlimited"
                value={advanced[f.key] ?? ""}
                onChange={(v) => setAdvanced({ ...advanced, [f.key]: typeof v === "number" ? v : undefined })}
                min={0}
                allowDecimal={!f.integer}
              />
            ))}
          </SimpleGrid>
        </Collapse>
        {error && (
          <Alert color="red" title="Could not save the limits">
            {error}
          </Alert>
        )}
        <Group justify="space-between">
          <Button variant="subtle" color="gray" onClick={clearAll} disabled={Object.keys(limits).length === 0}>
            Remove all limits
          </Button>
          <Group gap="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}

export function NetworkLimitsCard({ description }: { description?: string }) {
  const { bytesStringBase2: base2 } = usePreferences();
  const limits = useApi((signal) => api.repo.throttle({ signal }), []);
  const [editing, setEditing] = useState(false);
  const viaServer = limits.error instanceof ApiError && limits.error.code === "STORAGE_CONNECTION";

  return (
    <Card mt="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="nowrap" style={{ flex: "1 1 320px" }}>
          <IconGauge size={22} stroke={1.6} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
          <Stack gap={0}>
            <Text fw={600} size="sm">
              Network limits
            </Text>
            <Text size="sm" c="dimmed" data-testid="network-limits-summary">
              {viaServer
                ? "Not available for repositories on a Kopia server."
                : limits.error && !limits.data
                  ? `Could not load the limits: ${limits.error.message}`
                  : limits.data
                    ? limitsSummary(limits.data, base2)
                    : "Loading…"}
            </Text>
          </Stack>
        </Group>
        <Button size="xs" variant="default" onClick={() => setEditing(true)} disabled={!limits.data}>
          Edit…
        </Button>
      </Group>
      <Modal
        opened={editing}
        onClose={() => setEditing(false)}
        title={`Network limits${description ? " – " + description : ""}`}
        centered
      >
        {editing && limits.data && (
          <LimitsForm
            initial={limits.data}
            base2={base2}
            onClose={() => setEditing(false)}
            onSaved={() => void limits.refresh()}
          />
        )}
      </Modal>
    </Card>
  );
}
