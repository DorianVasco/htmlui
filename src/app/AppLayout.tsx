import React from "react";
import { Link, NavLink as RouterNavLink, Outlet } from "react-router";
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
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconAlertTriangle,
  IconArchive,
  IconDatabase,
  IconDatabaseOff,
  IconExternalLink,
  IconListCheck,
  IconMoon,
  IconSettings,
  IconShieldCheck,
  IconSun,
} from "@tabler/icons-react";
import { useTasksSummary } from "../api";
import { legacy } from "./legacy";
import { useRepoStatusContext } from "./repoStatus";

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const dark = useComputedColorScheme("light") === "dark";
  return (
    <Tooltip label={dark ? "Light mode" : "Dark mode"}>
      <ActionIcon variant="default" size="lg" onClick={() => setColorScheme(dark ? "light" : "dark")} aria-label="Toggle color scheme">
        {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

const navLinkStyle = { borderRadius: "var(--mantine-radius-md)" };

function AppNavLink({ label, to, icon: Icon, onClick }: { label: string; to: string; icon: typeof IconArchive; onClick: () => void }) {
  return (
    <NavLink
      component={RouterNavLink}
      to={to}
      label={label}
      leftSection={<Icon size={18} stroke={1.6} />}
      onClick={onClick}
      variant="light"
      style={navLinkStyle}
      mb={2}
    />
  );
}

/** Sidebar entry for a page that still lives in the old UI. */
function LegacyNavLink({ label, href, icon: Icon }: { label: string; href: string; icon: typeof IconArchive }) {
  return (
    <NavLink
      component="a"
      href={href}
      label={label}
      leftSection={<Icon size={18} stroke={1.6} />}
      rightSection={
        <Tooltip label="Opens the classic UI">
          <IconExternalLink size={14} stroke={1.6} color="var(--mantine-color-dimmed)" />
        </Tooltip>
      }
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
  if (status.error && !status.data) return <ServerUnreachable message={status.error.message} onRetry={() => void status.refresh()} />;
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

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const repoStatus = useRepoStatusContext();
  const connected = !!repoStatus.data?.connected;
  const { runningCount } = useTasksSummary({ enabled: connected });

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }} padding="lg">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <img src="/kopia-flat.svg" alt="" width={36} height={25} style={{ flexShrink: 0 }} />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Text fw={700} lh={1.1}>
                Kopia
              </Text>
              {connected && repoStatus.data?.description && (
                <Text size="xs" c="dimmed" lh={1.1} truncate>
                  {repoStatus.data.description}
                </Text>
              )}
            </Stack>
          </Group>
          <Group gap="sm" wrap="nowrap">
            {runningCount > 0 && (
              <Indicator processing size={8} offset={2}>
                <Badge component="a" href={legacy.tasks()} variant="light" style={{ cursor: "pointer" }}>
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
          <LegacyNavLink label="Policies" href={legacy.policies()} icon={IconShieldCheck} />
          <LegacyNavLink label="Tasks" href={legacy.tasks()} icon={IconListCheck} />
          <AppNavLink label="Repository" to="/repo" icon={IconDatabase} onClick={close} />
          <LegacyNavLink label="Preferences" href={legacy.preferences()} icon={IconSettings} />
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
