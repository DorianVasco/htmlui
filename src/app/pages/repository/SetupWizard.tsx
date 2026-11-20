import React, { FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import {
  Accordion,
  Alert,
  Button,
  Card,
  Group,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconCircleCheck, IconInfoCircle } from "@tabler/icons-react";
import { api, ApiError, useApi } from "../../../api";
import type { AlgorithmOption, Algorithms, RepoConnectRequest } from "../../../api";
import { rememberableStorage, rememberRepo, setActiveRepo, useKnownRepos } from "../../knownRepos";
import { PathField } from "../../PathField";
import { isMissingDirectory } from "../../storageErrors";
import { useRepoStatusContext } from "../../repoStatus";
import {
  cleanConfig,
  missingFields,
  STORAGE_TYPES,
  StorageConfig,
  storageType as findStorageType,
  validateConfig,
} from "./storageTypes";
import { StorageFields } from "./StorageFields";

type Mode = "create" | "connect";

/** Suggested repository locations (home-relative, resolved by the server). */
const REPOSITORY_LOCATIONS = ["~/kopia-repository", "~"];

const ECC_OVERHEAD = [
  { value: "0", label: "Disabled" },
  { value: "1", label: "1%" },
  { value: "2", label: "2%" },
  { value: "5", label: "5%" },
  { value: "10", label: "10%" },
];

function algorithmOptions(list: AlgorithmOption[] | undefined, defaultId: string | undefined) {
  return (list ?? []).map((a) => ({
    value: a.id,
    label: a.id + (a.id === defaultId ? " (recommended)" : a.deprecated ? " (not recommended)" : ""),
  }));
}

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "INVALID_PASSWORD":
        return "The password is not correct for this repository.";
      case "ALREADY_CONNECTED":
        return "The server is already connected to a repository. Disconnect it first.";
      case "ALREADY_INITIALIZED":
        return "A repository already exists at this location. Go back and connect to it instead.";
      case "STORAGE_CONNECTION":
        return "Cannot access the storage: " + err.message;
      default:
        return err.code ? `${err.message} (${err.code})` : err.message;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

export { isMissingDirectory };

interface AdvancedState {
  encryption: string | null;
  hash: string | null;
  splitter: string | null;
  ecc: string | null;
  eccOverheadPercent: string;
  legacyFormat: boolean;
}

function AdvancedCreateOptions({
  algorithms,
  value,
  onChange,
}: {
  algorithms?: Algorithms;
  value: AdvancedState;
  onChange: (v: AdvancedState) => void;
}) {
  const set = (patch: Partial<AdvancedState>) => onChange({ ...value, ...patch });
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <Select
        label="Encryption"
        data={algorithmOptions(algorithms?.encryption, algorithms?.defaultEncryption)}
        value={value.encryption ?? algorithms?.defaultEncryption ?? null}
        onChange={(v) => set({ encryption: v })}
        allowDeselect={false}
      />
      <Select
        label="Hash algorithm"
        data={algorithmOptions(algorithms?.hash, algorithms?.defaultHash)}
        value={value.hash ?? algorithms?.defaultHash ?? null}
        onChange={(v) => set({ hash: v })}
        allowDeselect={false}
      />
      <Select
        label="Splitter"
        data={algorithmOptions(algorithms?.splitter, algorithms?.defaultSplitter)}
        value={value.splitter ?? algorithms?.defaultSplitter ?? null}
        onChange={(v) => set({ splitter: v })}
        allowDeselect={false}
      />
      <Select
        label="Error correction overhead"
        description="Protects against bit rot, costs extra space."
        data={ECC_OVERHEAD}
        value={value.eccOverheadPercent}
        onChange={(v) => set({ eccOverheadPercent: v ?? "0" })}
        allowDeselect={false}
      />
      <Select
        label="Error correction algorithm"
        data={algorithmOptions(algorithms?.ecc, algorithms?.defaultEcc)}
        value={value.ecc ?? algorithms?.defaultEcc ?? null}
        onChange={(v) => set({ ecc: v })}
        disabled={value.eccOverheadPercent === "0"}
        allowDeselect={false}
      />
      <Switch
        mt="lg"
        label="Legacy format (Kopia 0.8 compatible)"
        description="Only needed for very old clients."
        checked={value.legacyFormat}
        onChange={(e) => set({ legacyFormat: e.currentTarget.checked })}
      />
    </SimpleGrid>
  );
}

export function SetupWizard() {
  const navigate = useNavigate();
  const repoStatus = useRepoStatusContext();
  const algorithms = useApi((signal) => api.repo.algorithms({ signal }), []);
  const currentUser = useApi((signal) => api.currentUser({ signal }), []);
  const { repos: knownRepos } = useKnownRepos();

  const [step, setStep] = useState(0);
  const [storageType, setStorageType] = useState("filesystem");
  const [path, setPath] = useState("");
  const [config, setConfig] = useState<StorageConfig>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [folderMissing, setFolderMissing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [description, setDescription] = useState("My Repository");
  const [username, setUsername] = useState<string | null>(null);
  const [hostname, setHostname] = useState<string | null>(null);
  const [readonly, setReadonly] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedState>({
    encryption: null,
    hash: null,
    splitter: null,
    ecc: null,
    eccOverheadPercent: "0",
    legacyFormat: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const type = findStorageType(storageType);
  const isFilesystem = storageType === "filesystem";
  const isToken = storageType === "_token";
  const storage = { type: storageType, config: isFilesystem ? { path: path.trim() } : cleanConfig(type, config) };
  const where = isFilesystem ? path.trim() : type.summary(storage.config);
  const goTo = (s: number) => {
    setError(null);
    setTouched(false);
    setStep(s);
  };
  const effectiveUser = username ?? currentUser.data?.username ?? "";
  const effectiveHost = hostname ?? currentUser.data?.hostname ?? "";

  const checkLocation = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFilesystem) {
      const empty = missingFields(type, config);
      setMissing(empty);
      if (empty.length) return;
      const invalid = validateConfig(type, config);
      if (invalid) {
        setError(invalid);
        return;
      }
      if (type.connectOnly) {
        // A Kopia server or a token always points at an existing repository.
        setMode("connect");
        setFolderMissing(false);
        goTo(2);
        return;
      }
    } else if (!path.trim()) {
      setError("Enter the directory where the repository is or should be stored.");
      return;
    }
    setChecking(true);
    setError(null);
    // Turn "~/backups" or other home-relative input into the absolute path the storage needs.
    let resolvedPath = path.trim();
    if (storageType === "filesystem") {
      try {
        const r = await api.sources.resolvePath(resolvedPath);
        if (r?.source?.path) resolvedPath = r.source.path;
      } catch {
        // keep the path as typed; the exists check below reports real problems
      }
      setPath(resolvedPath);
    }
    try {
      await api.repo.exists({
        storage: isFilesystem ? { type: storageType, config: { path: resolvedPath } } : storage,
      });
      setMode("connect");
      setFolderMissing(false);
      setStep(2);
    } catch (err) {
      if (err instanceof ApiError && err.code === "NOT_INITIALIZED") {
        setMode("create");
        setFolderMissing(false);
        setStep(2);
      } else if (storageType === "filesystem" && isMissingDirectory(err)) {
        // repo/create creates the directory, so a missing folder just means "new repository".
        setMode("create");
        setFolderMissing(true);
        setStep(2);
      } else {
        setError(errorText(err));
      }
    } finally {
      setChecking(false);
    }
  };

  const passwordError = touched && !password && !isToken ? "Enter a password" : undefined;
  const confirmError =
    touched && mode === "create" && password !== confirmPassword ? "Passwords don't match" : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if ((!password && !isToken) || (mode === "create" && password !== confirmPassword)) return;

    const clientOptions = { description, username: effectiveUser, hostname: effectiveHost, readonly };
    // Same request shapes as the old UI: a token replaces storage and password, a server uses apiServer.
    const request: RepoConnectRequest = isToken
      ? { token: String(storage.config.token ?? ""), clientOptions }
      : storageType === "_server"
        ? { apiServer: storage.config, password, clientOptions }
        : { storage, password, clientOptions };
    if (mode === "create") {
      const a = algorithms.data;
      request.options = {
        blockFormat: {
          // Omitting the version lets the server pick its current default format.
          ...(advanced.legacyFormat ? { version: 1 } : {}),
          hash: advanced.hash ?? a?.defaultHash,
          encryption: advanced.encryption ?? a?.defaultEncryption,
          ecc: advanced.ecc ?? a?.defaultEcc,
          eccOverheadPercent: parseInt(advanced.eccOverheadPercent, 10),
        },
        objectFormat: { splitter: advanced.splitter ?? a?.defaultSplitter },
      };
    }

    setSubmitting(true);
    setError(null);
    let didDisconnect = false;
    try {
      // A Kopia server holds one repository at a time: adding another replaces the current one.
      if (repoStatus.data?.connected) {
        await api.repo.disconnect();
        setActiveRepo(null);
        didDisconnect = true;
      }
      if (mode === "create") await api.repo.create(request);
      else await api.repo.connect(request);

      const remembered = rememberableStorage(storage);
      if (remembered) {
        rememberRepo({
          storage: remembered,
          description,
          clientOptions: { username: effectiveUser, hostname: effectiveHost, readonly },
        });
      }
      await repoStatus.refresh();
      notifications.show({
        color: "green",
        title: mode === "create" ? "Repository created" : "Connected",
        message: mode === "create" ? `New repository in ${where}` : `Connected to the repository in ${where}`,
      });
      navigate("/snapshots");
    } catch (err) {
      setError(errorText(err) + (didDisconnect ? " The server is now not connected to any repository." : ""));
      if (didDisconnect) void repoStatus.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const errorAlert = error && (
    <Alert color="red" icon={<IconAlertTriangle />} title="Something went wrong">
      {error}
    </Alert>
  );

  return (
    <Card maw={860}>
      <Stepper active={step} onStepClick={(s) => s < step && goTo(s)} allowNextStepsSelect={false} size="sm">
        <Stepper.Step label="Storage" description="Where to keep backups">
          <Stack mt="md">
            <Text size="sm" c="dimmed">
              Choose where the repository lives. Kopia encrypts everything before it is written there.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              {STORAGE_TYPES.map((t) => (
                <UnstyledButton
                  key={t.id}
                  onClick={() => {
                    if (t.id !== storageType) {
                      setConfig({ ...(t.defaults ?? {}) });
                      setMissing([]);
                    }
                    setStorageType(t.id);
                    goTo(1);
                  }}
                  aria-label={t.label}
                >
                  <Card
                    padding="md"
                    style={{
                      borderColor: storageType === t.id ? "var(--mantine-primary-color-filled)" : undefined,
                      height: "100%",
                    }}
                  >
                    <Group wrap="nowrap" align="flex-start">
                      <ThemeIcon variant="light" size={36} color={t.connectOnly ? "gray" : undefined}>
                        <t.icon size={20} />
                      </ThemeIcon>
                      <Stack gap={2}>
                        <Text fw={600} size="sm">
                          {t.label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t.description}
                        </Text>
                      </Stack>
                    </Group>
                  </Card>
                </UnstyledButton>
              ))}
            </SimpleGrid>
          </Stack>
        </Stepper.Step>

        <Stepper.Step
          label={isFilesystem ? "Location" : type.connectOnly ? "Connection" : "Settings"}
          description={isFilesystem ? "Directory path" : type.label}
        >
          <form onSubmit={checkLocation} noValidate>
            <Stack mt="md">
              {isFilesystem ? (
                <PathField
                  label="Directory"
                  description="An existing repository is detected automatically; an empty or new folder creates a new one."
                  placeholder={
                    navigator.platform.startsWith("Win") ? "e.g. D:\\Backups\\kopia" : "e.g. /mnt/backup/kopia"
                  }
                  value={path}
                  onChange={setPath}
                  recent={knownRepos
                    .filter((r) => r.storage.type === storageType)
                    .map((r) => ({ path: r.storage.config.path, label: r.description }))}
                  locations={REPOSITORY_LOCATIONS}
                  required
                  autoFocus
                />
              ) : (
                <>
                  {!type.connectOnly && (
                    <Text size="sm" c="dimmed">
                      An existing repository at this location is detected automatically; otherwise a new one is created.
                    </Text>
                  )}
                  <StorageFields type={type} config={config} onChange={setConfig} missing={missing} />
                </>
              )}
              {errorAlert}
              <Group justify="space-between">
                <Button variant="default" onClick={() => goTo(0)}>
                  Back
                </Button>
                <Button type="submit" loading={checking}>
                  Continue
                </Button>
              </Group>
            </Stack>
          </form>
        </Stepper.Step>

        <Stepper.Step label={mode === "connect" ? "Connect" : "Create"} description="Password and options">
          <form onSubmit={submit} noValidate>
            <Stack mt="md">
              {mode === "create" ? (
                <Alert color="blue" icon={<IconInfoCircle />} title="A new repository will be created">
                  <Text size="sm">
                    in <b>{where}</b>
                    {folderMissing ? " (the folder will be created)" : ""}. Choose a strong password – it encrypts your
                    backups and <b>cannot be recovered</b> if lost.
                  </Text>
                </Alert>
              ) : type.connectOnly ? (
                <Alert
                  color="blue"
                  icon={<IconInfoCircle />}
                  title={isToken ? "Connect with a token" : "Connect to a Kopia server"}
                >
                  <Text size="sm">
                    {isToken ? (
                      "The token contains the repository location and password."
                    ) : (
                      <>
                        at <b>{where}</b>. Enter the password the server's administrator set up for you.
                      </>
                    )}
                  </Text>
                </Alert>
              ) : (
                <Alert color="green" icon={<IconCircleCheck />} title="Existing repository found">
                  <Text size="sm">
                    in <b>{where}</b>. Enter its password to connect.
                  </Text>
                </Alert>
              )}

              {!isToken && (
                <SimpleGrid cols={{ base: 1, sm: mode === "create" ? 2 : 1 }}>
                  <PasswordInput
                    label={storageType === "_server" ? "Server password" : "Repository password"}
                    value={password}
                    onChange={(e) => setPassword(e.currentTarget.value)}
                    error={passwordError}
                    required
                    autoComplete={mode === "create" ? "new-password" : "current-password"}
                    data-autofocus
                    autoFocus
                  />
                  {mode === "create" && (
                    <PasswordInput
                      label="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                      error={confirmError}
                      required
                      autoComplete="new-password"
                    />
                  )}
                </SimpleGrid>
              )}

              <TextInput
                label="Description"
                description="Shown in the header to tell repositories apart."
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
              />

              <Accordion variant="contained">
                <Accordion.Item value="client">
                  <Accordion.Control>Identity of this computer</Accordion.Control>
                  <Accordion.Panel>
                    <SimpleGrid cols={{ base: 1, sm: 2 }}>
                      <TextInput
                        label="Username"
                        value={effectiveUser}
                        onChange={(e) => setUsername(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Hostname"
                        value={effectiveHost}
                        onChange={(e) => setHostname(e.currentTarget.value)}
                      />
                    </SimpleGrid>
                    <Text size="xs" c="dimmed" mt="xs">
                      Snapshots made from here are owned by {effectiveUser || "user"}@{effectiveHost || "host"}.
                    </Text>
                    {mode === "connect" && (
                      <Switch
                        mt="md"
                        label="Connect read-only"
                        checked={readonly}
                        onChange={(e) => setReadonly(e.currentTarget.checked)}
                      />
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
                {mode === "create" && (
                  <Accordion.Item value="format">
                    <Accordion.Control>Encryption and format</Accordion.Control>
                    <Accordion.Panel>
                      <AdvancedCreateOptions algorithms={algorithms.data} value={advanced} onChange={setAdvanced} />
                    </Accordion.Panel>
                  </Accordion.Item>
                )}
              </Accordion>

              {repoStatus.data?.connected && (
                <Alert color="yellow" icon={<IconInfoCircle />}>
                  <Text size="sm">
                    The server will disconnect from <b>{repoStatus.data.description || "the current repository"}</b>{" "}
                    first – a Kopia server holds one repository at a time. You can switch back from the repository list.
                  </Text>
                </Alert>
              )}

              {errorAlert}

              <Group justify="space-between">
                <Button variant="default" onClick={() => goTo(1)} disabled={submitting}>
                  Back
                </Button>
                <Button type="submit" loading={submitting}>
                  {mode === "create" ? "Create repository" : "Connect"}
                </Button>
              </Group>
            </Stack>
          </form>
        </Stepper.Step>
      </Stepper>
    </Card>
  );
}
