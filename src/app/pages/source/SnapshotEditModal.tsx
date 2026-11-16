// Edits a snapshot's description or adds/renames a pin (POST /snapshots/edit,
// as the old UI does). Pinned snapshots are never removed by retention.
import React, { useState } from "react";
import { Alert, Button, Group, Modal, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { api } from "../../../api";
import type { Snapshot } from "../../../api";
import { absoluteTime } from "../../format";

export type SnapshotEdit =
  | { kind: "description"; snapshot: Snapshot }
  /** Adds a pin, or renames `pin` when given. */
  | { kind: "pin"; snapshot: Snapshot; pin?: string };

export const DEFAULT_PIN = "do-not-delete";

export function SnapshotEditModal({
  edit,
  onClose,
  onSaved,
}: {
  edit: SnapshotEdit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const title = !edit
    ? ""
    : edit.kind === "description"
      ? "Snapshot description"
      : edit.pin
        ? "Rename pin"
        : "Pin snapshot";
  return (
    <Modal opened={!!edit} onClose={onClose} title={title} centered>
      {edit && (
        <EditForm
          key={edit.kind + edit.snapshot.id + (edit.kind === "pin" ? edit.pin : "")}
          edit={edit}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

function EditForm({ edit, onClose, onSaved }: { edit: SnapshotEdit; onClose: () => void; onSaved: () => void }) {
  const initial = edit.kind === "description" ? (edit.snapshot.description ?? "") : (edit.pin ?? DEFAULT_PIN);
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pins = edit.snapshot.pins ?? [];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (edit.kind === "pin") {
      if (!v) return setError("Enter a name for the pin.");
      if (v !== edit.pin && pins.includes(v)) return setError("This snapshot already has that pin.");
    }
    setBusy(true);
    setError(null);
    try {
      const snapshots = [edit.snapshot.id];
      if (edit.kind === "description") await api.snapshots.edit({ snapshots, description: v });
      else
        await api.snapshots.edit({ snapshots, addPins: [v], removePins: edit.pin && edit.pin !== v ? [edit.pin] : [] });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void save(e)} noValidate>
      <Stack>
        <Text size="sm" c="dimmed">
          Snapshot from {absoluteTime(edit.snapshot.startTime)}
        </Text>
        {edit.kind === "description" ? (
          <Textarea
            label="Description"
            description="Shown in the history instead of the time since the snapshot. Leave empty to remove it."
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            autosize
            minRows={2}
            data-autofocus
          />
        ) : (
          <TextInput
            label="Pin name"
            description="Pinned snapshots are kept even when the retention rules would delete them."
            value={value}
            onChange={(e) => {
              setValue(e.currentTarget.value);
              setError(null);
            }}
            data-autofocus
          />
        )}
        {error && (
          <Alert color="red" p="xs">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={busy}
            disabled={value.trim() === initial.trim() && !(edit.kind === "pin" && !edit.pin)}
          >
            {edit.kind === "pin" && !edit.pin ? "Pin" : "Save"}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
