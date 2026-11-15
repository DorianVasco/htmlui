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

/**
 * While the new UI is in development it lives under /ui; route paths below
 * match the old UI's, so switching over means changing only the basename.
 */
export const BASENAME = "/ui";

export function AppRoutes() {
  return (
    <RepoStatusProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/snapshots" replace />} />
          <Route path="/repo" element={<RepositoryPage />} />
          <Route element={<RequireConnection />}>
            <Route path="/snapshots" element={<DashboardPage />} />
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
      <Notifications position="top-right" />
      <PreferencesProvider>
        <BrowserRouter basename={BASENAME}>
          <AppRoutes />
        </BrowserRouter>
      </PreferencesProvider>
    </MantineProvider>
  );
}
