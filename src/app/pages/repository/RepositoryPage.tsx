import React, { useState } from "react";
import { useSearchParams } from "react-router";
import { Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconPlus } from "@tabler/icons-react";
import { PageHeader } from "../../components";
import { PageLoader, ServerUnreachable } from "../../AppLayout";
import { KnownRepo, useCurrentKnownRepo, useKnownRepos } from "../../knownRepos";
import { useRepoStatusContext } from "../../repoStatus";
import { ConnectedRepository } from "./ConnectedRepository";
import { KnownRepositoriesList } from "./KnownRepositoriesList";
import { SetupWizard } from "./SetupWizard";
import { SwitchRepositoryModal } from "./SwitchRepositoryModal";

/**
 * /repo: repository details and the list of known repositories when connected,
 * otherwise recent repositories plus the setup wizard.
 * `?switch=<id>` opens the switch dialog for a known repository (used by the header menu).
 */
export function RepositoryPage() {
  const status = useRepoStatusContext();
  const { repos } = useKnownRepos();
  const current = useCurrentKnownRepo(status.data);
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<KnownRepo | null>(null);
  const [adding, setAdding] = useState(false);

  const switchId = params.get("switch");
  const switchTarget = selected ?? (switchId ? (repos.find((r) => r.id === switchId) ?? null) : null);
  const closeSwitch = () => {
    setSelected(null);
    if (switchId) {
      params.delete("switch");
      setParams(params, { replace: true });
    }
  };

  if (status.isLoading) return <PageLoader />;
  if (status.error && !status.data)
    return <ServerUnreachable message={status.error.message} onRetry={() => void status.refresh()} />;
  if (status.data?.initTaskID) return <PageLoader label="Opening repository…" />;

  const connected = !!status.data?.connected;
  const addingWhileConnected = adding && connected;

  // The dialog stays at the same position in the tree for both layouts, so it keeps its
  // state (e.g. an error) when a failed switch leaves the server disconnected.
  return (
    <>
      {status.data?.connected && !adding ? (
        <>
          {/* key: reset local edits when the connected repository changes. */}
          <ConnectedRepository key={status.data.configFile ?? "repo"} status={status.data} currentId={current?.id} />
          <Stack mt="xl" gap="sm">
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Title order={4}>Repositories</Title>
                <Text size="sm" c="dimmed">
                  Switch between repositories you used in this browser. The server is connected to one at a time.
                </Text>
              </Stack>
              <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
                Add repository
              </Button>
            </Group>
            {repos.length ? (
              <KnownRepositoriesList
                repos={repos}
                currentId={current?.id}
                actionLabel="Switch"
                onSelect={setSelected}
              />
            ) : (
              <Text size="sm" c="dimmed">
                Repositories you create or connect from here will be listed for quick switching.
              </Text>
            )}
          </Stack>
        </>
      ) : (
        <>
          <PageHeader
            title={addingWhileConnected ? "Add a repository" : "Set up a repository"}
            description="Create a new repository or connect to an existing one."
            actions={
              addingWhileConnected && (
                <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={() => setAdding(false)}>
                  Back to current repository
                </Button>
              )
            }
          />
          {!addingWhileConnected && repos.length > 0 && (
            <Stack gap="sm" mb="xl" maw={860}>
              <Title order={4}>Recent repositories</Title>
              <KnownRepositoriesList repos={repos} actionLabel="Connect" onSelect={setSelected} />
            </Stack>
          )}
          <SetupWizard />
        </>
      )}
      <SwitchRepositoryModal repo={switchTarget} onClose={closeSwitch} />
    </>
  );
}
