// Type declarations for formatutils.js, so the TypeScript UI (src/app) can reuse it.
export function sizeDisplayName(size: number | undefined, bytesStringBase2?: boolean): string;
export function formatDuration(from: string | undefined, to?: string, useMultipleUnits?: boolean): string;
export function formatMilliseconds(ms: number, useMultipleUnits?: boolean): string;
export function rfc3339TimestampForDisplay(n: string | undefined): string;
export function formatOwnerName(s: { userName: string; host: string }): string;
export function compare(a: unknown, b: unknown): number;
