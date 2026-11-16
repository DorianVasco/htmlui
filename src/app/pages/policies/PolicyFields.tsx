// Form fields of the policy editor. Every field edits one path of the policy
// definition; an empty field is inherited, and its description shows the
// effective value and which policy defines it (from policy/resolve).
import React, { createContext, ReactNode, use, useState } from "react";
import {
  Anchor,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { Link } from "react-router";
import type { PolicyTarget, ResolvedPolicy } from "../../../api";
import { sizeDisplayName } from "../../format";
import {
  formatTimeOfDay,
  getPath,
  parseTimeOfDay,
  Policy,
  policyEditorPath,
  sameTarget,
  targetLabel,
  TimeOfDay,
} from "./policyModel";

interface EditorContextValue {
  policy: Policy;
  setField: (path: string, value: unknown) => void;
  resolved: ResolvedPolicy | null;
  target: PolicyTarget;
}

export const PolicyEditorContext = createContext<EditorContextValue | null>(null);

function useEditor(): EditorContextValue {
  const ctx = use(PolicyEditorContext);
  if (!ctx) throw new Error("policy fields must be used inside PolicyEditorContext");
  return ctx;
}

function displayValue(v: unknown, format?: (v: unknown) => string): string {
  if (v === undefined || v === null) return "not set";
  if (format) return format(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v))
    return v.length
      ? v.map((x) => (typeof x === "object" && x ? formatTimeOfDay(x as TimeOfDay) : String(x))).join(", ")
      : "none";
  return String(v);
}

/** "Effective: 10 · from Global policy" — or nothing while unresolved. */
function Effective({ path, format }: { path: string; format?: (v: unknown) => string }) {
  const { resolved, target } = useEditor();
  if (!resolved) return null;
  const value = getPath(resolved.effective, path);
  const definedBy = getPath(resolved.definition, path) as PolicyTarget | undefined;
  return (
    <Text span size="xs" c="dimmed" data-testid={"effective-" + path}>
      Effective: {displayValue(value, format)}
      {definedBy && (definedBy.host !== undefined || definedBy.userName !== undefined) && (
        <>
          {" · "}
          {sameTarget(definedBy, target) ? (
            "set here"
          ) : (
            <>
              from{" "}
              <Anchor component={Link} to={policyEditorPath(definedBy)} size="xs">
                {targetLabel(definedBy)}
              </Anchor>
            </>
          )}
        </>
      )}
    </Text>
  );
}

function Description({ help, path, format }: { help?: ReactNode; path: string; format?: (v: unknown) => string }) {
  return (
    <Stack gap={0} component="span">
      {help && (
        <Text span size="xs" c="dimmed">
          {help}
        </Text>
      )}
      <Effective path={path} format={format} />
    </Stack>
  );
}

export function NumberField({
  path,
  label,
  help,
  bytes,
  disabled,
  placeholder,
}: {
  path: string;
  label: string;
  help?: ReactNode;
  bytes?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { policy, setField } = useEditor();
  const v = getPath(policy, path);
  const format = bytes
    ? (x: unknown) => `${sizeDisplayName(Number(x))} (${Number(x).toLocaleString()} bytes)`
    : undefined;
  return (
    <NumberInput
      label={label}
      description={<Description help={help} path={path} format={format} />}
      value={typeof v === "number" ? v : ""}
      onChange={(x) => setField(path, typeof x === "number" ? x : undefined)}
      min={0}
      allowDecimal={false}
      thousandSeparator={bytes ? "," : undefined}
      placeholder={placeholder ?? "inherit"}
      suffix={bytes ? " bytes" : undefined}
      disabled={disabled}
    />
  );
}

/** Inherit / Yes / No. */
export function BooleanField({ path, label, help }: { path: string; label: string; help?: ReactNode }) {
  const { policy, setField } = useEditor();
  const v = getPath(policy, path);
  return (
    <Group justify="space-between" wrap="wrap" gap="xs" align="flex-start">
      <Stack gap={2} style={{ flex: "1 1 260px" }}>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        <Description help={help} path={path} />
      </Stack>
      <SegmentedControl
        size="xs"
        aria-label={label}
        value={v === true ? "yes" : v === false ? "no" : "inherit"}
        onChange={(x) => setField(path, x === "yes" ? true : x === "no" ? false : undefined)}
        data={[
          { label: "Inherit", value: "inherit" },
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" },
        ]}
      />
    </Group>
  );
}

/** On/off setting of this policy only (not inherited), e.g. noParent. */
export function FlagField({ path, label, help }: { path: string; label: string; help?: ReactNode }) {
  const { policy, setField } = useEditor();
  const v = getPath(policy, path) === true;
  return (
    <Group justify="space-between" wrap="wrap" gap="xs" align="flex-start">
      <Stack gap={2} style={{ flex: "1 1 260px" }}>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        {help && (
          <Text size="xs" c="dimmed">
            {help}
          </Text>
        )}
      </Stack>
      <SegmentedControl
        size="xs"
        aria-label={label}
        value={v ? "yes" : "no"}
        onChange={(x) => setField(path, x === "yes" ? true : undefined)}
        data={[
          { label: "No", value: "no" },
          { label: "Yes", value: "yes" },
        ]}
      />
    </Group>
  );
}

export function SelectField({
  path,
  label,
  help,
  data,
  numeric,
  format,
}: {
  path: string;
  label: string;
  help?: ReactNode;
  data: { value: string; label: string }[];
  numeric?: boolean;
  format?: (v: unknown) => string;
}) {
  const { policy, setField } = useEditor();
  const v = getPath(policy, path);
  return (
    <Select
      label={label}
      description={<Description help={help} path={path} format={format} />}
      data={data}
      value={v === undefined || v === null ? null : String(v)}
      onChange={(x) => setField(path, x === null ? undefined : numeric ? Number(x) : x)}
      placeholder="inherit"
      clearable
      comboboxProps={{ withinPortal: true }}
    />
  );
}

export function TextField({
  path,
  label,
  help,
  placeholder,
}: {
  path: string;
  label: string;
  help?: ReactNode;
  placeholder?: string;
}) {
  const { policy, setField } = useEditor();
  const v = getPath(policy, path);
  return (
    <TextInput
      label={label}
      description={<Description help={help} path={path} />}
      value={typeof v === "string" ? v : ""}
      onChange={(e) => setField(path, e.currentTarget.value || undefined)}
      placeholder={placeholder}
    />
  );
}

/** A list edited as tags (Enter adds an entry). */
export function TagsField({
  path,
  label,
  help,
  placeholder,
}: {
  path: string;
  label: string;
  help?: ReactNode;
  placeholder?: string;
}) {
  const { policy, setField } = useEditor();
  const v = getPath(policy, path);
  return (
    <TagsInput
      label={label}
      description={<Description help={help} path={path} />}
      value={Array.isArray(v) ? v.map(String) : []}
      onChange={(x) => setField(path, x.length ? x : undefined)}
      placeholder={placeholder}
      splitChars={[]}
      clearable
    />
  );
}

/** A list edited one entry per line (ignore rules, cron expressions). */
export function LinesField({
  path,
  label,
  help,
  placeholder,
}: {
  path: string;
  label: string;
  help?: ReactNode;
  placeholder?: string;
}) {
  const { policy, setField } = useEditor();
  const v = getPath(policy, path);
  return (
    <Textarea
      label={label}
      description={<Description help={help} path={path} />}
      value={Array.isArray(v) ? v.join("\n") : ""}
      onChange={(e) => setField(path, e.currentTarget.value ? e.currentTarget.value.split("\n") : undefined)}
      placeholder={placeholder}
      autosize
      minRows={3}
      maxRows={12}
      styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
    />
  );
}

/** Times of day as tags like "02:00"; invalid entries are rejected with a message. */
export function TimesOfDayField({ path, label, help }: { path: string; label: string; help?: ReactNode }) {
  const { policy, setField } = useEditor();
  const [error, setError] = useState<string | null>(null);
  const v = getPath(policy, path);
  const times = Array.isArray(v) ? (v as TimeOfDay[]) : [];
  return (
    <TagsInput
      label={label}
      description={<Description help={help} path={path} />}
      value={times.map(formatTimeOfDay)}
      onChange={(tags) => {
        const parsed = tags.map(parseTimeOfDay);
        const bad = tags.filter((_, i) => !parsed[i]);
        setError(bad.length ? `Not a time of day: ${bad.join(", ")} (use 24-hour HH:MM)` : null);
        const valid = parsed
          .filter((t): t is TimeOfDay => !!t)
          .sort((a, b) => a.hour * 60 + a.min - (b.hour * 60 + b.min));
        setField(path, valid.length ? valid : undefined);
      }}
      placeholder="e.g. 02:00"
      splitChars={[",", " "]}
      error={error}
      clearable
    />
  );
}
