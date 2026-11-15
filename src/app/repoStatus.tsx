// Repository connection state, owned by AppLayout and shared with pages
// (so e.g. the setup page can refresh it after connecting).
import React, { createContext, ReactNode, use, useEffect } from "react";
import { onNotConnected, useRepoStatus } from "../api";
import type { PollingResult, RepoStatus } from "../api";

const RepoStatusContext = createContext<PollingResult<RepoStatus> | null>(null);

export function RepoStatusProvider({ children }: { children: ReactNode }) {
  // Polls only while the server is still opening the repository.
  const status = useRepoStatus({ interval: (d) => (d?.initTaskID ? 1000 : null) });
  const { refresh } = status;

  // Any request failing with NOT_CONNECTED re-checks the status.
  useEffect(() => onNotConnected(() => void refresh()), [refresh]);

  return <RepoStatusContext value={status}>{children}</RepoStatusContext>;
}

export function useRepoStatusContext(): PollingResult<RepoStatus> {
  const ctx = use(RepoStatusContext);
  if (!ctx) throw new Error("useRepoStatusContext must be used inside RepoStatusProvider");
  return ctx;
}
