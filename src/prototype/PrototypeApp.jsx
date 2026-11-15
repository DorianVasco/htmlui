import React, { useState } from "react";
import {
  ActionIcon,
  AppShell,
  Badge,
  Burger,
  Group,
  Indicator,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconArchive,
  IconDatabase,
  IconListCheck,
  IconMoon,
  IconSettings,
  IconShieldCheck,
  IconSun,
} from "@tabler/icons-react";
import { repoStatus, tasks } from "./mockData";
import { SnapshotsPage } from "./pages/SnapshotsPage";
import { SourceDetailPage } from "./pages/SourceDetailPage";
import { TasksPage } from "./pages/TasksPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { RepositoryPage } from "./pages/RepositoryPage";
import { PreferencesPage } from "./pages/PreferencesPage";

const runningTasks = tasks.filter((t) => t.status === "RUNNING").length;

const navItems = [
  { key: "snapshots", label: "Snapshots", icon: IconArchive },
  { key: "policies", label: "Policies", icon: IconShieldCheck },
  { key: "tasks", label: "Tasks", icon: IconListCheck, badge: runningTasks },
  { key: "repo", label: "Repository", icon: IconDatabase },
  { key: "prefs", label: "Preferences", icon: IconSettings },
];

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light");
  const dark = computed === "dark";
  return (
    <Tooltip label={dark ? "Light mode" : "Dark mode"}>
      <ActionIcon variant="default" size="lg" onClick={() => setColorScheme(dark ? "light" : "dark")} aria-label="Toggle color scheme">
        {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

export function PrototypeApp() {
  const [opened, { toggle, close }] = useDisclosure();
  const [route, setRoute] = useState({ page: "snapshots" });

  const navigate = (next) => {
    setRoute(next);
    close();
    window.scrollTo(0, 0);
  };

  const activeNav = route.page === "source" ? "snapshots" : route.page;

  let content;
  switch (route.page) {
    case "source":
      content = <SourceDetailPage source={route.source} navigate={navigate} />;
      break;
    case "tasks":
      content = <TasksPage />;
      break;
    case "policies":
      content = <PoliciesPage />;
      break;
    case "repo":
      content = <RepositoryPage />;
      break;
    case "prefs":
      content = <PreferencesPage />;
      break;
    default:
      content = <SnapshotsPage navigate={navigate} />;
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: "teal", to: "cyan", deg: 135 }}>
              <IconArchive size={20} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text fw={700} lh={1.1}>
                Kopia
              </Text>
              <Text size="xs" c="dimmed" lh={1.1} truncate>
                {repoStatus.description}
              </Text>
            </Stack>
          </Group>
          <Group gap="sm" wrap="nowrap">
            {runningTasks > 0 && (
              <Indicator processing color="teal" size={8} offset={2}>
                <Badge variant="light" color="teal" style={{ cursor: "pointer" }} onClick={() => navigate({ page: "tasks" })}>
                  {runningTasks} running
                </Badge>
              </Indicator>
            )}
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section grow component={ScrollArea}>
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              label={item.label}
              leftSection={<item.icon size={18} stroke={1.6} />}
              rightSection={
                item.badge ? (
                  <Badge size="xs" circle color="teal">
                    {item.badge}
                  </Badge>
                ) : null
              }
              active={activeNav === item.key}
              onClick={() => navigate({ page: item.key })}
              variant="light"
              style={{ borderRadius: "var(--mantine-radius-md)" }}
              mb={2}
            />
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <Group gap={6} px="sm" py="xs">
            <Badge size="xs" variant="dot" color="green">
              Connected
            </Badge>
            <Text size="xs" c="dimmed">
              v0.21 · prototype
            </Text>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{content}</AppShell.Main>
    </AppShell>
  );
}
