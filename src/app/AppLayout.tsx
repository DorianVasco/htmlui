import React from "react";
import { Link, NavLink as RouterNavLink, Outlet, useNavigate } from "react-router";
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Burger,
  Button,
  Center,
  Group,
  Indicator,
  Loader,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconAlertTriangle,
  IconArchive,
  IconCheck,
  IconDatabase,
  IconDatabaseOff,
  IconFolder,
  IconListCheck,
  IconMoon,
  IconSelector,
  IconSettings,
  IconShieldCheck,
  IconSun,
} from "@tabler/icons-react";
import { useTasksSummary } from "../api";
import { useRepoStatusContext } from "./repoStatus";
import { useCurrentKnownRepo, useKnownRepos } from "./knownRepos";

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const dark = useComputedColorScheme("light") === "dark";
  return (
    <Tooltip label={dark ? "Light mode" : "Dark mode"}>
      <ActionIcon
        variant="default"
        size="lg"
        onClick={() => setColorScheme(dark ? "light" : "dark")}
        aria-label="Toggle color scheme"
      >
        {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

const navLinkStyle = { borderRadius: "var(--mantine-radius-md)" };

function AppNavLink({
  label,
  to,
  icon: Icon,
  onClick,
  badge,
}: {
  label: string;
  to: string;
  icon: typeof IconArchive;
  onClick: () => void;
  /** Count shown at the right, e.g. running tasks. */
  badge?: number;
}) {
  return (
    <NavLink
      component={RouterNavLink}
      to={to}
      label={label}
      leftSection={<Icon size={18} stroke={1.6} />}
      rightSection={
        badge ? (
          <Badge size="xs" circle aria-label={`${badge} running`}>
            {badge}
          </Badge>
        ) : null
      }
      onClick={onClick}
      variant="light"
      style={navLinkStyle}
      mb={2}
    />
  );
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <Center h="60vh">
      <Stack align="center" gap="xs">
        <Loader />
        {label && <Text c="dimmed">{label}</Text>}
      </Stack>
    </Center>
  );
}

export function ServerUnreachable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Center h="60vh">
      <Alert color="red" title="Cannot reach the Kopia server" icon={<IconAlertTriangle />} maw={480}>
        <Stack gap="sm">
          <Text size="sm">{message}</Text>
          <Group>
            <Button size="xs" variant="light" color="red" onClick={onRetry}>
              Try again
            </Button>
          </Group>
        </Stack>
      </Alert>
    </Center>
  );
}

/** Route element for pages that need a connected repository. */
export function RequireConnection() {
  const status = useRepoStatusContext();

  if (status.isLoading) return <PageLoader />;
  if (status.error && !status.data)
    return <ServerUnreachable message={status.error.message} onRetry={() => void status.refresh()} />;
  if (status.data?.initTaskID) return <PageLoader label="Opening repository…" />;

  if (!status.data?.connected) {
    return (
      <Center h="60vh">
        <Stack align="center" gap="sm" maw={420} ta="center">
          <ThemeIcon size={56} radius="xl" variant="light" color="gray">
            <IconDatabaseOff size={30} />
          </ThemeIcon>
          <Title order={3}>Not connected to a repository</Title>
          <Text c="dimmed" size="sm">
            Connect to an existing repository or create a new one to start backing up.
          </Text>
          <Button component={Link} to="/repo">
            Set up repository
          </Button>
        </Stack>
      </Center>
    );
  }

  return <Outlet />;
}

/** App title with the current repository; a menu for quick switching once repositories are known. */
function RepositorySwitcher() {
  const navigate = useNavigate();
  const repoStatus = useRepoStatusContext();
  const { repos } = useKnownRepos();
  const current = useCurrentKnownRepo(repoStatus.data);
  const connected = !!repoStatus.data?.connected;
  const description = connected ? repoStatus.data?.description : undefined;

  const title = (
    <Stack gap={0} style={{ minWidth: 0 }}>
      <Text fw={700} lh={1.1}>
        Kopia
      </Text>
      {description && (
        <Text size="xs" c="dimmed" lh={1.1} truncate>
          {description}
        </Text>
      )}
    </Stack>
  );

  if (!repos.length) return title;

  return (
    <Menu position="bottom-start" width={300} withinPortal>
      <Menu.Target>
        <UnstyledButton aria-label="Switch repository" style={{ minWidth: 0 }}>
          <Group gap={4} wrap="nowrap">
            {title}
            <IconSelector size={14} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Repositories</Menu.Label>
        {repos.map((r) => (
          <Menu.Item
            key={r.id}
            leftSection={r.id === current?.id ? <IconCheck size={16} /> : <IconFolder size={16} />}
            disabled={r.id === current?.id}
            onClick={() => navigate("/repo?switch=" + encodeURIComponent(r.id))}
          >
            <Text size="sm" truncate>
              {r.description || "Unnamed repository"}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {r.storage.config.path}
            </Text>
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => navigate("/repo")}>
          Manage repositories
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const repoStatus = useRepoStatusContext();
  const connected = !!repoStatus.data?.connected;
  const { runningCount } = useTasksSummary({ enabled: connected });

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <img src="/kopia-flat.svg" alt="" width={36} height={25} style={{ flexShrink: 0 }} />
            <RepositorySwitcher />
          </Group>
          <Group gap="sm" wrap="nowrap">
            {runningCount > 0 && (
              <Indicator processing size={8} offset={2}>
                <Badge component={Link} to="/tasks?status=running" variant="light" style={{ cursor: "pointer" }}>
                  {runningCount} running
                </Badge>
              </Indicator>
            )}
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          <AppNavLink label="Snapshots" to="/snapshots" icon={IconArchive} onClick={close} />
          <AppNavLink label="Policies" to="/policies" icon={IconShieldCheck} onClick={close} />
          <AppNavLink label="Tasks" to="/tasks" icon={IconListCheck} onClick={close} badge={runningCount} />
          <AppNavLink label="Repository" to="/repo" icon={IconDatabase} onClick={close} />
          <AppNavLink label="Preferences" to="/preferences" icon={IconSettings} onClick={close} />
        </AppShell.Section>
        <AppShell.Section>
          <Group gap={6} px="sm" py="xs">
            {repoStatus.data &&
              (connected ? (
                <Badge size="xs" variant="dot" color="green">
                  Connected
                </Badge>
              ) : (
                <Badge size="xs" variant="dot" color="gray">
                  Not connected
                </Badge>
              ))}
            <Text size="xs" c="dimmed">
              new UI preview
            </Text>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
