// Restores a snapshot (or a single file/folder of one) to a folder, ZIP or TAR file
// on the server's computer. Mirrors the old UI's restore request.
import React, { useState } from "react";
import { Link } from "react-router";
import {
  Anchor,
  Button,
  Collapse,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronDown, IconChevronRight, IconFolder, IconRestore } from "@tabler/icons-react";
import { api } from "../../../api";
import type { RestoreRequest } from "../../../api";

export interface RestoreTarget {
  /** Object ID of the snapshot root or of an entry inside it. */
  oid: string;
  /** What is restored, for the dialog title (e.g. a date or a file name). */
  title: string;
  /** Suggested destination. */
  defaultDestination: string;
}

export interface RestoreOptions {
  overwrite: boolean;
  restorePermissions: boolean;
  restoreOwners: boolean;
  restoreTimes: boolean;
  continueOnErrors: boolean;
  incremental: boolean;
}

export const DEFAULT_RESTORE_OPTIONS: RestoreOptions = {
  overwrite: false,
  restorePermissions: true,
  restoreOwners: true,
  restoreTimes: true,
  continueOnErrors: false,
  incremental: true,
};

/** Builds the /restore request. Destinations ending in .zip or .tar become archives. */
export function restoreRequest(oid: string, destination: string, o: RestoreOptions): RestoreRequest {
  const dst = destination.trim();
  const req: RestoreRequest = {
    root: oid,
    options: {
      incremental: o.incremental,
      ignoreErrors: o.continueOnErrors,
      restoreDirEntryAtDepth: 1000,
      minSizeForPlaceholder: 0,
    },
  };
  if (/\.zip$/i.test(dst)) {
    req.zipFile = dst;
    req.uncompressedZip = true;
  } else if (/\.tar$/i.test(dst)) {
    req.tarFile = dst;
  } else {
    req.fsOutput = {
      targetPath: dst,
      skipOwners: !o.restoreOwners,
      skipPermissions: !o.restorePermissions,
      skipTimes: !o.restoreTimes,
      ignorePermissionErrors: true,
      overwriteFiles: o.overwrite,
      overwriteDirectories: o.overwrite,
      overwriteSymlinks: o.overwrite,
      writeFilesAtomically: false,
      writeSparseFiles: false,
    };
  }
  return req;
}

export function RestoreModal({ target, onClose }: { target: RestoreTarget | null; onClose: () => void }) {
  return (
    <Modal opened={!!target} onClose={onClose} title={target ? `Restore ${target.title}` : ""} centered size="lg">
      {/* Keyed so each opening starts with fresh form state. */}
      {target && <RestoreForm key={target.oid} target={target} onClose={onClose} />}
    </Modal>
  );
}

function RestoreForm({ target, onClose }: { target: RestoreTarget; onClose: () => void }) {
  const [destination, setDestination] = useState(target.defaultDestination);
  const [o, setO] = useState<RestoreOptions>(DEFAULT_RESTORE_OPTIONS);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof RestoreOptions) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setO({ ...o, [k]: e.currentTarget.checked });
  const archive = /\.(zip|tar)$/i.test(destination.trim());

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) {
      setError("Enter where to restore to.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const task = await api.restore(restoreRequest(target.oid, destination, o));
      notifications.show({
        color: "blue",
        title: "Restore started",
        message: (
          <>
            Restoring to {destination.trim()}.{" "}
            <Anchor component={Link} to={"/tasks/" + encodeURIComponent(task.id)} size="sm">
              Show progress
            </Anchor>
          </>
        ),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void start(e)}>
      <Stack>
        <TextInput
          label="Restore to"
          description="A folder on the server's computer. End the name with .zip or .tar to create an archive instead."
          value={destination}
          onChange={(e) => setDestination(e.currentTarget.value)}
          leftSection={<IconFolder size={16} />}
          error={error}
          data-autofocus
        />
        {!archive && (
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <Switch label="Overwrite existing files" checked={o.overwrite} onChange={set("overwrite")} />
            <Switch label="Restore modification times" checked={o.restoreTimes} onChange={set("restoreTimes")} />
            <Switch label="Restore permissions" checked={o.restorePermissions} onChange={set("restorePermissions")} />
            <Switch label="Restore owners" checked={o.restoreOwners} onChange={set("restoreOwners")} />
          </SimpleGrid>
        )}
        <UnstyledButton onClick={() => setAdvanced((a) => !a)}>
          <Group gap={4}>
            {advanced ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            <Text size="sm" c="dimmed">
              More options
            </Text>
          </Group>
        </UnstyledButton>
        <Collapse expanded={advanced}>
          <Stack gap="sm">
            <Switch
              label="Continue on errors"
              description="Skip files that can't be restored instead of stopping."
              checked={o.continueOnErrors}
              onChange={set("continueOnErrors")}
            />
            <Switch
              label="Skip files restored before"
              description="Resume an interrupted restore into the same location."
              checked={o.incremental}
              onChange={set("incremental")}
            />
          </Stack>
        </Collapse>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" leftSection={<IconRestore size={16} />} loading={busy}>
            Start restore
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
