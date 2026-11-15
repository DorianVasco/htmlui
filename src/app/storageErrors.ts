import { ApiError } from "../api";

/**
 * The server has no error code for "directory does not exist": filesystem storage
 * reports an internal error such as "cannot access storage path: … cannot find the
 * file specified" (Windows) or "… no such file or directory" (Unix).
 */
export function isMissingDirectory(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return (
    /cannot access storage path/i.test(err.message) &&
    /cannot find the (file|path) specified|no such file or directory/i.test(err.message)
  );
}
