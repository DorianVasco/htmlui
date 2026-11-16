import React, { useState } from "react";
import { Badge, Button, Card, Group, Modal, SimpleGrid, Stack, Table, Text, TextInput, ThemeIcon } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconDatabase, IconPlugConnectedX } from "@tabler/icons-react";
import { api } from "../../../api";
import type { RepoStatus } from "../../../api";
import { PageHeader } from "../../components";
import { useRepoStatusContext } from "../../repoStatus";
import { setActiveRepo, updateRepo } from "../../knownRepos";
import { CliEquivalent } from "../../cli";

function showError(title: string, err: unknown) {
  notifications.show({ color: "red", title, message: err instanceof Error ? err.message : String(err) });
}

function detailRows(s: RepoStatus): [string, React.ReactNode][] {
  const rows: [string, React.ReactNode][] = [
    ["Config file", s.configFile],
    ["Storage", s.storage],
    ["Encryption", s.encryption],
    ["Hash", s.hash],
    ["Splitter", s.splitter],
    ["Format version", s.formatVersion],
    ["Error correction", s.eccOverheadPercent ? `${s.ecc} (${s.eccOverheadPercent}%)` : "disabled"],
    ["Connected as", s.username && s.hostname ? `${s.username}@${s.hostname}` : undefined],
  ];
  if (s.apiServerURL) rows.splice(1, 1, ["Server", s.apiServerURL]);
  return rows.filter(([, v]) => v !== undefined && v !== "");
}

export function ConnectedRepository({ status, currentId }: { status: RepoStatus; currentId?: string }) {
  const repoStatus = useRepoStatusContext();
  const [description, setDescription] = useState(status.description ?? "");
  const [savingDescription, setSavingDescription] = useState(false);
  const [confirmOpened, confirm] = useDisclosure(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const saveDescription = async () => {
    setSavingDescription(true);
    try {
      await api.repo.setDescription(description);
      if (currentId) updateRepo(currentId, { description });
      await repoStatus.refresh();
      notifications.show({ color: "green", message: "Description saved" });
    } catch (err) {
      showError("Could not save description", err);
    } finally {
      setSavingDescription(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await api.repo.disconnect();
      setActiveRepo(null);
      confirm.close();
      await repoStatus.refresh();
    } catch (err) {
      showError("Could not disconnect", err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Repository"
        description="Where your snapshots are stored."
        actions={
          <Button color="red" variant="light" leftSection={<IconPlugConnectedX size={16} />} onClick={confirm.open}>
            Disconnect
          </Button>
        }
      />
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Card>
          <Stack align="flex-start">
            <ThemeIcon size={48} radius="md" variant="light">
              <IconDatabase size={28} />
            </ThemeIcon>
            <Group gap="xs">
              <Badge variant="dot" color="green">
                Connected
              </Badge>
              {status.readonly && <Badge color="yellow">Read-only</Badge>}
            </Group>
            <TextInput
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              w="100%"
            />
            <Button
              size="xs"
              variant="default"
              loading={savingDescription}
              disabled={description === (status.description ?? "")}
              onClick={() => void saveDescription()}
            >
              Save description
            </Button>
          </Stack>
        </Card>
        <Card padding={0} style={{ gridColumn: "span 2" }}>
          <Table>
            <Table.Tbody>
              {detailRows(status).map(([k, v]) => (
                <Table.Tr key={k}>
                  <Table.Td w={170}>
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
        </Card>
      </SimpleGrid>
      <CliEquivalent command="repository status" />

      <Modal opened={confirmOpened} onClose={confirm.close} title="Disconnect from repository?" centered>
        <Stack>
          <Text size="sm">
            This computer stops making snapshots until it is connected again. The repository and its snapshots are{" "}
            <b>not</b> deleted, and it stays in your repository list.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={confirm.close}>
              Cancel
            </Button>
            <Button color="red" loading={disconnecting} onClick={() => void disconnect()}>
              Disconnect
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
