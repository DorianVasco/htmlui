// Storage types offered by Kopia and the settings each one needs. The fields and
// their names match the old UI's setup forms (and the server's storage config).
// "_server" and "_token" are not storage: they connect to an existing repository
// through a Kopia server or with a token, so they can't create one.
import {
  IconBrandAws,
  IconBrandAzure,
  IconBrandGoogle,
  IconCloud,
  IconFolder,
  IconKey,
  IconServer,
  IconServer2,
  IconTerminal2,
  IconWorldWww,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";

export type StorageConfig = Record<string, string | number | boolean | undefined>;

export interface StorageField {
  key: string;
  label: string;
  kind?: "text" | "password" | "number" | "switch" | "textarea";
  required?: boolean;
  placeholder?: string;
  description?: string;
  /** Hidden unless this returns true. */
  visible?: (c: StorageConfig) => boolean;
  /** Takes half the width on wide screens. */
  half?: boolean;
  /** Multi-line JSON, sent to the server as an object. */
  json?: boolean;
}

export interface StorageType {
  id: string;
  label: string;
  description: string;
  icon: Icon;
  fields: StorageField[];
  defaults?: StorageConfig;
  /** Extra checks beyond required fields; returns an error message. */
  validate?: (c: StorageConfig) => string | null;
  /** Only connecting is possible (Kopia server, token). */
  connectOnly?: boolean;
  /** Short human-readable location, e.g. "bucket/prefix" (see docs/ui-spec/native-only.md). */
  summary: (c: Record<string, unknown>) => string;
}

const filled = (c: StorageConfig, k: string) => c[k] !== undefined && c[k] !== "" && c[k] !== false;
const exactlyOne = (c: StorageConfig, keys: string[]) => keys.filter((k) => filled(c, k)).length === 1;
const prefixed = (base: unknown, prefix: unknown) =>
  String(base ?? "") + (prefix ? "/" + String(prefix).replace(/^\/+/, "") : "");
const prefixField: StorageField = {
  key: "prefix",
  label: "Object name prefix",
  placeholder: "optional, e.g. kopia/",
  half: true,
};

export const STORAGE_TYPES: StorageType[] = [
  {
    id: "filesystem",
    label: "Local directory or NAS",
    description: "A folder on this computer, an external drive or a network share.",
    icon: IconFolder,
    fields: [{ key: "path", label: "Directory", required: true }],
    summary: (c) => String(c.path ?? ""),
  },
  {
    id: "s3",
    label: "Amazon S3 or compatible",
    description: "AWS S3, MinIO, Wasabi, Cloudflare R2 and others.",
    icon: IconBrandAws,
    defaults: { endpoint: "s3.amazonaws.com", doNotUseTLS: false, doNotVerifyTLS: false },
    fields: [
      { key: "bucket", label: "Bucket", required: true, half: true },
      { key: "endpoint", label: "Server endpoint", required: true, placeholder: "s3.amazonaws.com", half: true },
      { key: "accessKeyID", label: "Access key ID", required: true, half: true },
      { key: "secretAccessKey", label: "Secret access key", kind: "password", required: true, half: true },
      { key: "region", label: "Region", placeholder: "optional, e.g. us-east-1", half: true },
      prefixField,
      { key: "sessionToken", label: "Session token", kind: "password", placeholder: "optional" },
      { key: "doNotUseTLS", label: "Use HTTP (insecure)", kind: "switch" },
      { key: "doNotVerifyTLS", label: "Don't verify TLS certificate", kind: "switch" },
    ],
    summary: (c) => prefixed(c.bucket, c.prefix),
  },
  {
    id: "b2",
    label: "Backblaze B2",
    description: "Backblaze B2 cloud storage.",
    icon: IconCloud,
    fields: [
      { key: "bucket", label: "Bucket", required: true, half: true },
      prefixField,
      { key: "keyID", label: "Key ID", required: true, half: true },
      { key: "key", label: "Key", kind: "password", required: true, half: true },
    ],
    summary: (c) => prefixed(c.bucket, c.prefix),
  },
  {
    id: "gcs",
    label: "Google Cloud Storage",
    description: "A Google Cloud Storage bucket.",
    icon: IconBrandGoogle,
    fields: [
      { key: "bucket", label: "Bucket", required: true, half: true },
      prefixField,
      {
        key: "credentialsFile",
        label: "Credentials file",
        placeholder: "path on the server to a service account JSON file",
        description: "Leave both credential fields empty to use the server's default Google credentials.",
      },
      {
        key: "credentials",
        label: "Credentials JSON",
        kind: "textarea",
        json: true,
        placeholder: "or paste the service account JSON",
      },
    ],
    validate: (c) =>
      filled(c, "credentialsFile") && filled(c, "credentials")
        ? "Give either a credentials file or credentials JSON, not both."
        : null,
    summary: (c) => prefixed(c.bucket, c.prefix),
  },
  {
    id: "azureBlob",
    label: "Azure Blob Storage",
    description: "A Microsoft Azure storage container.",
    icon: IconBrandAzure,
    fields: [
      { key: "storageAccount", label: "Storage account", required: true, half: true },
      { key: "container", label: "Container", required: true, half: true },
      { key: "storageKey", label: "Access key", kind: "password", half: true, placeholder: "access key or SAS token" },
      { key: "sasToken", label: "SAS token", kind: "password", half: true, placeholder: "access key or SAS token" },
      prefixField,
      {
        key: "storageDomain",
        label: "Storage domain",
        placeholder: "optional, e.g. blob.core.windows.net",
        half: true,
      },
    ],
    summary: (c) => prefixed(c.container, c.prefix),
  },
  {
    id: "sftp",
    label: "SFTP server",
    description: "Any server reachable over SSH/SFTP.",
    icon: IconServer,
    defaults: { port: 22 },
    fields: [
      { key: "host", label: "Host", required: true, placeholder: "e.g. nas.example.com", half: true },
      { key: "port", label: "Port", kind: "number", required: true, half: true },
      { key: "username", label: "User", required: true, half: true },
      { key: "path", label: "Path", required: true, placeholder: "e.g. /mnt/data/kopia", half: true },
      {
        key: "externalSSH",
        label: "Launch external password-less SSH command",
        kind: "switch",
        description:
          "Supports all ssh options and password-less keys from your ssh config, but is slower than the built-in client.",
      },
      { key: "password", label: "Password", kind: "password", visible: (c) => !c.externalSSH, half: true },
      {
        key: "keyfile",
        label: "Path to key file",
        placeholder: "path on the server",
        visible: (c) => !c.externalSSH,
        half: true,
      },
      {
        key: "keyData",
        label: "Key data",
        kind: "textarea",
        placeholder: "or paste the private key",
        visible: (c) => !c.externalSSH,
      },
      {
        key: "knownHostsFile",
        label: "Path to known_hosts file",
        placeholder: "path on the server",
        visible: (c) => !c.externalSSH,
        half: true,
      },
      {
        key: "knownHostsData",
        label: "Known hosts data",
        kind: "textarea",
        placeholder: "or paste the lines from known_hosts",
        visible: (c) => !c.externalSSH,
      },
      { key: "sshCommand", label: "SSH command", placeholder: "ssh", visible: (c) => !!c.externalSSH, half: true },
      {
        key: "sshArguments",
        label: "SSH arguments",
        placeholder: "e.g. -i ~/.ssh/kopia",
        visible: (c) => !!c.externalSSH,
        half: true,
      },
    ],
    validate: (c) => {
      if (c.externalSSH) return null;
      if (!exactlyOne(c, ["password", "keyfile", "keyData"]))
        return "Give exactly one of password, path to key file or key data.";
      if (!exactlyOne(c, ["knownHostsFile", "knownHostsData"]))
        return "Give either a path to a known_hosts file or known hosts data.";
      return null;
    },
    summary: (c) => `${c.username ? c.username + "@" : ""}${c.host ?? ""}:${c.path ?? ""}`,
  },
  {
    id: "webdav",
    label: "WebDAV server",
    description: "Nextcloud, ownCloud and other WebDAV servers.",
    icon: IconWorldWww,
    fields: [
      {
        key: "url",
        label: "Server URL",
        required: true,
        placeholder: "https://cloud.example.com/remote.php/dav/files/me/kopia",
      },
      { key: "username", label: "Username", half: true },
      { key: "password", label: "Password", kind: "password", half: true },
    ],
    summary: (c) => String(c.url ?? ""),
  },
  {
    id: "rclone",
    label: "Rclone remote",
    description: "Any backend supported by rclone.",
    icon: IconTerminal2,
    fields: [
      { key: "remotePath", label: "Remote path", required: true, placeholder: "e.g. gdrive:backups/kopia", half: true },
      { key: "rcloneExe", label: "Rclone executable", placeholder: "rclone", half: true },
    ],
    summary: (c) => String(c.remotePath ?? ""),
  },
  {
    id: "_server",
    label: "Kopia repository server",
    description: "A repository shared by a Kopia server.",
    icon: IconServer2,
    connectOnly: true,
    fields: [
      { key: "url", label: "Server address", required: true, placeholder: "https://kopia.example.com:51515" },
      {
        key: "serverCertFingerprint",
        label: "Trusted certificate fingerprint (SHA-256)",
        placeholder: "only needed for self-signed certificates",
      },
    ],
    summary: (c) => String(c.url ?? ""),
  },
  {
    id: "_token",
    label: "Repository token",
    description: "Connect using a token from another Kopia client.",
    icon: IconKey,
    connectOnly: true,
    fields: [
      {
        key: "token",
        label: "Token",
        kind: "password",
        required: true,
        description:
          "Get it on another computer with “kopia repository status -t -s”. It contains the repository password.",
      },
    ],
    summary: () => "a repository token",
  },
];

export const storageType = (id: string) => STORAGE_TYPES.find((t) => t.id === id) ?? STORAGE_TYPES[0];

const isVisible = (f: StorageField, c: StorageConfig) => !f.visible || f.visible(c);

function parseJson(v: unknown): unknown {
  try {
    return JSON.parse(String(v));
  } catch {
    return undefined;
  }
}

/**
 * Visible, non-empty settings only, as the server expects them: text trimmed,
 * JSON fields parsed into objects (e.g. GCS credentials).
 */
export function cleanConfig(type: StorageType, c: StorageConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of type.fields) {
    if (!isVisible(f, c)) continue;
    const v = c[f.key];
    if (v === undefined || v === "") continue;
    if (f.json) out[f.key] = parseJson(v);
    else out[f.key] = typeof v === "string" && f.kind !== "textarea" && f.kind !== "password" ? v.trim() : v;
  }
  return out;
}

/** Keys of required fields that are empty (shown as “Required” under each field). */
export function missingFields(type: StorageType, c: StorageConfig): string[] {
  return type.fields.filter((f) => f.required && isVisible(f, c) && !filled(c, f.key)).map((f) => f.key);
}

/** Problems beyond empty required fields: invalid JSON and the type's own checks. */
export function validateConfig(type: StorageType, c: StorageConfig): string | null {
  const badJson = type.fields.find(
    (f) => f.json && isVisible(f, c) && filled(c, f.key) && parseJson(c[f.key]) === undefined,
  );
  if (badJson) return `${badJson.label} is not valid JSON.`;
  return type.validate?.(c) ?? null;
}
