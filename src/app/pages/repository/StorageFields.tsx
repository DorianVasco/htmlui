// Settings form for one storage type, rendered from its field list.
import React from "react";
import { NumberInput, PasswordInput, SimpleGrid, Stack, Switch, Textarea, TextInput } from "@mantine/core";
import type { StorageConfig, StorageField, StorageType } from "./storageTypes";

function Field({
  f,
  config,
  onChange,
  autoFocus,
  error,
}: {
  f: StorageField;
  config: StorageConfig;
  onChange: (c: StorageConfig) => void;
  autoFocus: boolean;
  error?: string;
}) {
  const set = (v: string | number | boolean | undefined) => onChange({ ...config, [f.key]: v });
  const value = config[f.key];
  const common = {
    label: f.label,
    description: f.description,
    placeholder: f.placeholder,
    required: f.required,
    autoFocus,
    "data-autofocus": autoFocus || undefined,
    error,
  };
  switch (f.kind) {
    case "password":
      return (
        <PasswordInput
          {...common}
          value={String(value ?? "")}
          onChange={(e) => set(e.currentTarget.value)}
          autoComplete="off"
        />
      );
    case "number":
      return (
        <NumberInput
          {...common}
          value={typeof value === "number" ? value : ""}
          onChange={(v) => set(typeof v === "number" ? v : undefined)}
          min={1}
          max={65535}
          hideControls
          allowDecimal={false}
        />
      );
    case "textarea":
      return (
        <Textarea
          {...common}
          value={String(value ?? "")}
          onChange={(e) => set(e.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={10}
          styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12 } }}
        />
      );
    case "switch":
      return (
        <Switch
          label={f.label}
          description={f.description}
          checked={!!value}
          onChange={(e) => set(e.currentTarget.checked)}
        />
      );
    default:
      return <TextInput {...common} value={String(value ?? "")} onChange={(e) => set(e.currentTarget.value)} />;
  }
}

/** Fields flagged `half` sit side by side; the others take the full width. */
export function StorageFields({
  type,
  config,
  onChange,
  missing = [],
}: {
  type: StorageType;
  config: StorageConfig;
  onChange: (c: StorageConfig) => void;
  /** Keys of required fields to mark as “Required”. */
  missing?: string[];
}) {
  const fields = type.fields.filter((f) => !f.visible || f.visible(config));
  const groups: StorageField[][] = [];
  for (const f of fields) {
    const last = groups[groups.length - 1];
    if (f.half && last && last.length === 1 && last[0].half) last.push(f);
    else groups.push([f]);
  }
  return (
    <Stack gap="sm">
      {groups.map((g) =>
        g.length === 2 || g[0].half ? (
          <SimpleGrid key={g[0].key} cols={{ base: 1, sm: 2 }} spacing="sm">
            {g.map((f) => (
              <Field
                key={f.key}
                f={f}
                config={config}
                onChange={onChange}
                autoFocus={f === fields[0]}
                error={missing.includes(f.key) ? "Required" : undefined}
              />
            ))}
          </SimpleGrid>
        ) : (
          <Field
            key={g[0].key}
            f={g[0]}
            config={config}
            onChange={onChange}
            autoFocus={g[0] === fields[0]}
            error={missing.includes(g[0].key) ? "Required" : undefined}
          />
        ),
      )}
    </Stack>
  );
}
