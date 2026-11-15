// HTTP client for the Kopia server REST API (/api/v1).
//
// - Sends the CSRF token the server injects into index.html
//   (<meta name="kopia-csrf-token">); "-" when absent, like the old UI.
// - Normalizes failures into ApiError (server message + code).
// - Lets the app register a handler for NOT_CONNECTED, e.g. to route to /repo.
import axios, { AxiosError, AxiosInstance } from "axios";

export const API_BASE = "/api/v1";
export const CSRF_HEADER = "X-Kopia-Csrf-Token";

export class ApiError extends Error {
  /** HTTP status, 0 for network errors. */
  readonly status: number;
  /** Machine-readable code from the server, e.g. "NOT_CONNECTED". */
  readonly code?: string;
  readonly cause?: unknown;

  constructor(message: string, status: number, code?: string, cause?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.cause = cause;
  }
}

export function isNotConnected(err: unknown): boolean {
  return err instanceof ApiError && err.code === "NOT_CONNECTED";
}

export function isCanceled(err: unknown): boolean {
  return axios.isCancel(err) || (err instanceof ApiError && err.code === "ERR_CANCELED");
}

type NotConnectedHandler = (err: ApiError) => void;
let notConnectedHandler: NotConnectedHandler | null = null;

/** Registers a callback invoked whenever a request fails with NOT_CONNECTED. Returns an unregister function. */
export function onNotConnected(handler: NotConnectedHandler): () => void {
  notConnectedHandler = handler;
  return () => {
    if (notConnectedHandler === handler) notConnectedHandler = null;
  };
}

export function readCsrfToken(doc: Document = document): string {
  const tok = doc.head?.querySelector<HTMLMetaElement>('meta[name="kopia-csrf-token"]');
  return tok && tok.content ? tok.content : "-";
}

interface ServerErrorBody {
  error?: string;
  code?: string;
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<ServerErrorBody>;
    if (ax.code === "ERR_CANCELED") {
      return new ApiError("Request canceled", 0, "ERR_CANCELED", err);
    }
    const body = ax.response?.data;
    const message = (body && typeof body === "object" && body.error) || ax.message || "Request failed";
    const code = (body && typeof body === "object" && body.code) || undefined;
    return new ApiError(message, ax.response?.status ?? 0, code, err);
  }
  if (err instanceof Error) return new ApiError(err.message, 0, undefined, err);
  return new ApiError(String(err), 0, undefined, err);
}

export function createApiClient(): AxiosInstance {
  const instance = axios.create({ baseURL: API_BASE });
  let csrfToken: string | null = null;

  instance.interceptors.request.use((config) => {
    if (csrfToken === null) csrfToken = readCsrfToken();
    config.headers.set(CSRF_HEADER, csrfToken);
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (err) => {
      const apiErr = toApiError(err);
      if (apiErr.code === "NOT_CONNECTED" && notConnectedHandler) {
        notConnectedHandler(apiErr);
      }
      return Promise.reject(apiErr);
    },
  );

  return instance;
}

export const apiClient = createApiClient();

/**
 * Encodes a snapshot source / policy target as query string, matching
 * policyutil.sourceQueryStringParams but treating missing parts as "".
 */
export function sourceQuery(src: { userName?: string; host?: string; path?: string }): string {
  return (
    "userName=" +
    encodeURIComponent(src.userName ?? "") +
    "&host=" +
    encodeURIComponent(src.host ?? "") +
    "&path=" +
    encodeURIComponent(src.path ?? "")
  );
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export async function get<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  const res = await apiClient.get<T>(url, { signal: opts.signal });
  return res.data;
}

export async function post<T>(url: string, body: unknown = {}, opts: RequestOptions = {}): Promise<T> {
  const res = await apiClient.post<T>(url, body, { signal: opts.signal });
  return res.data;
}

export async function put<T>(url: string, body: unknown, opts: RequestOptions = {}): Promise<T> {
  const res = await apiClient.put<T>(url, body, { signal: opts.signal });
  return res.data;
}

export async function del<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  const res = await apiClient.delete<T>(url, { signal: opts.signal });
  return res.data;
}
