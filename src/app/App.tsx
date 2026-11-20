import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { theme } from "./theme";
import { AppLayout, RequireConnection } from "./AppLayout";
import { RepoStatusProvider } from "./repoStatus";
import { RepositoryPage } from "./pages/repository/RepositoryPage";
import { PreferencesProvider } from "./preferences";
import { DashboardPage } from "./pages/DashboardPage";
import { NewSnapshotPage } from "./pages/NewSnapshotPage";
import { SourceDetailPage } from "./pages/source/SourceDetailPage";
import { TasksPage } from "./pages/tasks/TasksPage";
import { PreferencesPage } from "./pages/preferences/PreferencesPage";
import { PoliciesPage } from "./pages/policies/PoliciesPage";

export function AppRoutes() {
  return (
    <RepoStatusProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/snapshots" replace />} />
          <Route path="/repo" element={<RepositoryPage />} />
          <Route path="/preferences" element={<PreferencesPage />} />
          <Route element={<RequireConnection />}>
            <Route path="/snapshots" element={<DashboardPage />} />
            <Route path="/snapshots/new" element={<NewSnapshotPage />} />
            <Route path="/snapshots/single-source" element={<SourceDetailPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/policies/edit" element={<PoliciesPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:tid" element={<TasksPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/snapshots" replace />} />
        </Route>
      </Routes>
    </RepoStatusProvider>
  );
}

export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <PreferencesProvider>
        <BrowserRouter>
          {/* Inside the router, so notifications can contain router links. */}
          <Notifications position="top-right" />
          <AppRoutes />
        </BrowserRouter>
      </PreferencesProvider>
    </MantineProvider>
  );
}
