// Policies (/policies) with the editor in a drawer at /policies/edit?userName=…&host=…&path=…
// (the same URLs as the old UI).
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconAlertTriangle, IconPlus, IconSearch } from "@tabler/icons-react";
import { api, useApi, useSources } from "../../../api";
import type { PolicyListEntry, PolicyTarget } from "../../../api";
import { PageHeader } from "../../components";
import { PolicyEditorDrawer } from "./PolicyEditor";
import {
  definedSections,
  KIND_INFO,
  parsePolicyTarget,
  policyEditorPath,
  policyKind,
  targetLabel,
} from "./policyModel";

type Scope = "local" | "all";

/** Global, this computer's host/user policies and this user's folder policies come first. */
export function filterPolicies(
  list: PolicyListEntry[],
  scope: Scope,
  local: { userName: string; host: string },
  query: string,
): PolicyListEntry[] {
  const q = query.trim().toLowerCase();
  return list
    .filter((p) => {
      if (scope === "all") return true;
      const t = p.target;
      return !t.host || (t.host === local.host && (!t.userName || t.userName === local.userName));
    })
    .filter(
      (p) => !q || [targetLabel(p.target), p.target.userName, p.target.host].some((s) => s?.toLowerCase().includes(q)),
    )
    .sort(
      (a, b) =>
        KIND_INFO[policyKind(a.target)].order - KIND_INFO[policyKind(b.target)].order ||
        targetLabel(a.target).localeCompare(targetLabel(b.target)),
    );
}

function NewPolicyModal({
  opened,
  onClose,
  local,
}: {
  opened: boolean;
  onClose: () => void;
  local: { userName: string; host: string };
}) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parsePolicyTarget(input, local);
    if ("error" in target) {
      setError(target.error);
      return;
    }
    setInput("");
    setError(null);
    onClose();
    navigate(policyEditorPath(target));
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New policy" centered>
      <form onSubmit={submit} noValidate>
        <Stack>
          <TextInput
            label="Applies to"
            description={
              <>
                A folder path (for {local.userName}@{local.host}), <code>user@computer</code> for all folders of a user,
                or <code>@computer</code> for everything on a computer.
              </>
            }
            placeholder={local.host ? `e.g. C:\\Data or @${local.host}` : "e.g. /home/me/Documents"}
            value={input}
            onChange={(e) => {
              setInput(e.currentTarget.value);
              setError(null);
            }}
            error={error}
            data-autofocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Continue</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function PoliciesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const policies = useApi((signal) => api.policies.list({ signal }), []);
  const sources = useSources();
  const [scope, setScope] = useState<Scope>("local");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const localUser = sources.data?.localUsername ?? "";
  const localHost = sources.data?.localHost ?? "";
  const local = useMemo(() => ({ userName: localUser, host: localHost }), [localUser, localHost]);
  const list = useMemo(() => policies.data?.policies ?? [], [policies.data]);
  const visible = useMemo(() => filterPolicies(list, scope, local, query), [list, scope, local, query]);

  // /policies/edit?… opens the editor for that target.
  const editing: PolicyTarget | null = location.pathname.endsWith("/edit")
    ? { userName: params.get("userName") ?? "", host: params.get("host") ?? "", path: params.get("path") ?? "" }
    : null;

  return (
    <>
      <PageHeader
        title="Policies"
        description="Schedules, retention and file rules. A folder's policy overrides its user's, which overrides the computer's and the global policy."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
            New policy
          </Button>
        }
      />

      <Group mb="md" gap="sm">
        <TextInput
          placeholder="Search"
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          style={{ flex: "1 1 220px" }}
          maw={360}
          aria-label="Search policies"
        />
        <SegmentedControl
          size="sm"
          value={scope}
          onChange={(v) => setScope(v as Scope)}
          data={[
            { label: "This computer", value: "local" },
            { label: "All", value: "all" },
          ]}
          aria-label="Show policies of"
        />
      </Group>

      {policies.isLoading ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : policies.error && !policies.data ? (
        <Alert color="red" title="Could not load policies" icon={<IconAlertTriangle />}>
          {policies.error.message}
        </Alert>
      ) : (
        <Card padding={0}>
          <Table.ScrollContainer minWidth={600}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={120}>Type</Table.Th>
                  <Table.Th>Applies to</Table.Th>
                  <Table.Th>Defines</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((p) => {
                  const kind = policyKind(p.target);
                  const sections = definedSections(p.policy);
                  return (
                    <Table.Tr
                      key={JSON.stringify(p.target)}
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate(policyEditorPath(p.target))}
                      data-testid="policy-row"
                    >
                      <Table.Td>
                        <Badge variant="light" color={KIND_INFO[kind].color}>
                          {KIND_INFO[kind].label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text size="sm" fw={600} style={{ wordBreak: "break-all" }}>
                            {targetLabel(p.target)}
                          </Text>
                          {kind === "directory" && (
                            <Text size="xs" c="dimmed">
                              {p.target.userName}@{p.target.host}
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {sections.length ? (
                            sections.map((s) => (
                              <Badge key={s} size="sm" variant="default" tt="none" fw={500}>
                                {s}
                              </Badge>
                            ))
                          ) : (
                            <Text size="sm" c="dimmed">
                              nothing
                            </Text>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {visible.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={3}>
                      <Text ta="center" c="dimmed" py="lg">
                        {list.length ? "No policies match." : "No policies yet."}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      <NewPolicyModal opened={creating} onClose={() => setCreating(false)} local={local} />
      <PolicyEditorDrawer
        target={editing}
        onClose={() => navigate("/policies")}
        onChanged={() => void policies.refresh()}
      />
    </>
  );
}
