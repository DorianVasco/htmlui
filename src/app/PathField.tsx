// Folder path input with selection help.
//
// Kopia's API cannot list the server's folders, and browsers never reveal
// absolute paths, so a real folder browser is only possible in the KopiaUI
// desktop app (window.kopiaUI.selectDirectory). Everywhere else the field
// offers suggestions: recently used paths and common locations, resolved to
// absolute paths by the server (paths/resolve expands "~" and home-relative paths).
import React, { ReactNode } from "react";
import { ActionIcon, Autocomplete, Group, Text, Tooltip } from "@mantine/core";
import { IconFolder, IconFolderOpen, IconHome } from "@tabler/icons-react";
import { api, useApi } from "../api";

export interface PathSuggestion {
  path: string;
  /** Optional caption shown next to the path, e.g. a repository description. */
  label?: string;
}

declare global {
  interface Window {
    /** Bridge provided by the KopiaUI desktop app (Electron). */
    kopiaUI?: { selectDirectory(cb: (path: string) => void): void; browseDirectory(path: string): void };
  }
}

export function hasNativeFolderPicker(): boolean {
  return typeof window !== "undefined" && !!window.kopiaUI?.selectDirectory;
}

/** Resolves home-relative locations like "~/Documents" to absolute paths on the server. */
export function useResolvedLocations(locations: string[]): string[] {
  const key = locations.join("|");
  const { data } = useApi(
    async (signal) => {
      const results = await Promise.allSettled(locations.map((p) => api.sources.resolvePath(p, { signal })));
      return results.flatMap((r) => (r.status === "fulfilled" && r.value?.source?.path ? [r.value.source.path] : []));
    },
    [key],
    { enabled: locations.length > 0 },
  );
  return data ?? [];
}

export function PathField({
  label,
  description,
  placeholder,
  value,
  onChange,
  recent = [],
  locations = [],
  error,
  required,
  autoFocus,
  rightSection,
}: {
  label: string;
  description?: ReactNode;
  placeholder?: string;
  value: string;
  onChange: (path: string) => void;
  /** Recently used paths (shown first). */
  recent?: PathSuggestion[];
  /** Common locations, home-relative (e.g. "~/Documents"); resolved by the server. */
  locations?: string[];
  error?: ReactNode;
  required?: boolean;
  autoFocus?: boolean;
  rightSection?: ReactNode;
}) {
  const resolvedLocations = useResolvedLocations(locations);
  const captions = new Map(recent.map((r) => [r.path, r.label]));

  const recentPaths = [...new Set(recent.map((r) => r.path))];
  const locationPaths = resolvedLocations.filter((p) => !recentPaths.includes(p));
  const data = [
    ...(recentPaths.length ? [{ group: "Recently used", items: recentPaths }] : []),
    ...(locationPaths.length ? [{ group: "Common locations", items: [...new Set(locationPaths)] }] : []),
  ];

  const native = hasNativeFolderPicker();

  return (
    <Autocomplete
      label={label}
      description={
        <>
          {description}
          {description ? " " : ""}
          {native
            ? "Use Browse to pick a folder."
            : "Pick a suggestion, type a path on the server's computer (“~” is your home folder)."}
        </>
      }
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      data={data}
      limit={20}
      maxDropdownHeight={280}
      // Show all suggestions on focus; once typing, narrow them down.
      filter={({ options, search }) => {
        const q = search.trim().toLowerCase();
        if (!q) return options;
        return options
          .map((o) =>
            "items" in o
              ? { ...o, items: o.items.filter((i) => i.value.toLowerCase().includes(q) && i.value !== search) }
              : o,
          )
          .filter((o) => !("items" in o) || o.items.length > 0);
      }}
      renderOption={({ option }) => (
        <Group gap="xs" wrap="nowrap">
          {option.value === resolvedLocations[0] ? <IconHome size={16} /> : <IconFolder size={16} />}
          <div style={{ minWidth: 0 }}>
            <Text size="sm" style={{ wordBreak: "break-all" }}>
              {option.value}
            </Text>
            {captions.get(option.value) && (
              <Text size="xs" c="dimmed">
                {captions.get(option.value)}
              </Text>
            )}
          </div>
        </Group>
      )}
      leftSection={<IconFolder size={16} />}
      rightSectionWidth={native ? 36 : undefined}
      rightSection={
        rightSection ??
        (native ? (
          <Tooltip label="Browse…">
            <ActionIcon
              variant="subtle"
              aria-label="Browse for folder"
              onClick={() => window.kopiaUI?.selectDirectory((p) => p && onChange(p))}
            >
              <IconFolderOpen size={18} />
            </ActionIcon>
          </Tooltip>
        ) : null)
      }
      error={error}
      required={required}
      autoFocus={autoFocus}
      data-autofocus={autoFocus || undefined}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
