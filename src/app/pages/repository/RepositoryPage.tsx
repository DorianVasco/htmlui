import React from "react";
import { PageHeader } from "../../components";
import { PageLoader, ServerUnreachable } from "../../AppLayout";
import { useRepoStatusContext } from "../../repoStatus";
import { ConnectedRepository } from "./ConnectedRepository";
import { SetupWizard } from "./SetupWizard";

/** /repo: repository details when connected, otherwise the setup wizard. */
export function RepositoryPage() {
  const status = useRepoStatusContext();

  if (status.isLoading) return <PageLoader />;
  if (status.error && !status.data) return <ServerUnreachable message={status.error.message} onRetry={() => void status.refresh()} />;
  if (status.data?.initTaskID) return <PageLoader label="Opening repository…" />;

  if (status.data?.connected) {
    // key: reset local edits when the connected repository changes.
    return <ConnectedRepository key={status.data.configFile ?? "repo"} status={status.data} />;
  }

  return (
    <>
      <PageHeader title="Set up a repository" description="Create a new repository or connect to an existing one." />
      <SetupWizard />
    </>
  );
}
