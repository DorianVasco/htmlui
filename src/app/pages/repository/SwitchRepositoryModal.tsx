import React, { FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Button, Group, Modal, PasswordInput, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { api, ApiError } from "../../../api";
import { KnownRepo, rememberRepo, setActiveRepo, useCurrentKnownRepo } from "../../knownRepos";
import { useRepoStatusContext } from "../../repoStatus";

function connectErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "INVALID_PASSWORD") return "The password is not correct for this repository.";
    if (err.code === "NOT_INITIALIZED") return "There is no repository at this location anymore.";
    return err.code ? `${err.message} (${err.code})` : err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Asks for the password and switches the server to `repo`: disconnects the
 * current repository (a Kopia server holds one at a time), then connects.
 */
export function SwitchRepositoryModal({ repo, onClose }: { repo: KnownRepo | null; onClose: () => void }) {
  const navigate = useNavigate();
  const repoStatus = useRepoStatusContext();
  const current = useCurrentKnownRepo(repoStatus.data);
  const connected = !!repoStatus.data?.connected;

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnectedOnError, setDisconnectedOnError] = useState(false);

  const close = () => {
    setPassword("");
    setError(null);
    setDisconnectedOnError(false);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!repo || !password) return;
    setBusy(true);
    setError(null);
    let didDisconnect = false;
    try {
      if (repoStatus.data?.connected) {
        await api.repo.disconnect();
        setActiveRepo(null);
        didDisconnect = true;
      }
      await api.repo.connect({
        storage: repo.storage,
        password,
        clientOptions: { ...repo.clientOptions, description: repo.description },
      });
      rememberRepo({ storage: repo.storage, description: repo.description, clientOptions: repo.clientOptions });
      await repoStatus.refresh();
      notifications.show({ color: "green", title: "Switched repository", message: repo.description || repo.storage.config.path });
      close();
      navigate("/snapshots");
    } catch (err) {
      setError(connectErrorText(err));
      setDisconnectedOnError(didDisconnect);
      if (didDisconnect) void repoStatus.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={!!repo} onClose={close} title={repo ? `Switch to “${repo.description || repo.storage.config.path}”` : ""} centered>
      {repo && (
        <form onSubmit={submit}>
          <Stack>
            <Text size="sm" c="dimmed" style={{ wordBreak: "break-all" }}>
              {repo.storage.config.path}
            </Text>
            {connected && !disconnectedOnError && (
              <Alert color="blue" icon={<IconInfoCircle />}>
                <Text size="sm">
                  The server is disconnected from {current ? <b>{current.description}</b> : "the current repository"} first. Scheduled snapshots only run for
                  the connected repository.
                </Text>
              </Alert>
            )}
            <PasswordInput
              label="Repository password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              autoComplete="current-password"
              data-autofocus
              required
            />
            {error && (
              <Alert color="red" icon={<IconAlertTriangle />}>
                <Text size="sm">{error}</Text>
                {disconnectedOnError && (
                  <Text size="sm" mt={4}>
                    The server is now not connected to any repository. Try again or pick another one.
                  </Text>
                )}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!password}>
                {connected && !disconnectedOnError ? "Switch" : "Connect"}
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
