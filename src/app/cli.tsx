// "CLI equivalents": the kopia command line that does what a page shows, for
// people who want to script it. Off by default; switched on in Preferences
// (stored in this browser, like the theme).
import React, { useSyncExternalStore } from "react";
import { ActionIcon, Code, CopyButton, Group, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy, IconTerminal2 } from "@tabler/icons-react";
import { api, useApi } from "../api";
import type { PolicyTarget } from "../api";

const KEY = "kopia-show-cli";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setShowCli(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the setting just doesn't stick
  }
  listeners.forEach((l) => l());
}

export function useShowCli(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => false,
  );
}

/** Quotes an argument for the shell when needed. */
export const q = (s: string) => (/^[\w@:./\\-]+$/.test(s) ? s : `"${s.replace(/"/g, '\\"')}"`);

/** The policy target as the CLI expects it. */
export function cliPolicyTarget(t: PolicyTarget): string {
  if (!t.host && !t.userName) return "--global";
  if (!t.userName) return "@" + t.host;
  if (!t.path) return `${t.userName}@${t.host}`;
  return q(`${t.userName}@${t.host}:${t.path}`);
}

/** Shows `kopia <command>` with a copy button, when CLI equivalents are switched on. */
export function CliEquivalent({ command }: { command: string }) {
  const show = useShowCli();
  if (!show) return null;
  return <CliLine command={command} />;
}

function CliLine({ command }: { command: string }) {
  const info = useApi((signal) => api.cliInfo({ signal }), []);
  // The server reports the full executable path plus --config-file; show it all so it can be pasted as is.
  const full = `${info.data?.executable ?? "kopia"} ${command}`;
  return (
    <Group gap="xs" wrap="nowrap" mt="md" data-testid="cli-equivalent">
      <Tooltip label="Command line equivalent">
        <IconTerminal2 size={16} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
      </Tooltip>
      <Code style={{ flex: 1, minWidth: 0, overflowX: "auto", whiteSpace: "nowrap" }} title={full}>
        kopia {command}
      </Code>
      <CopyButton value={full}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? "Copied" : "Copy full command"}>
            <ActionIcon variant="subtle" size="sm" onClick={copy} aria-label="Copy command">
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}
