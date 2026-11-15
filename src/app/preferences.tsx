// Read-only view of the server-side UI preferences (/api/v1/ui-preferences).
// The old UI owns writing them (its theme values differ from Mantine's color
// scheme, which the new UI keeps in localStorage), so nothing is written here.
import React, { createContext, ReactNode, use } from "react";
import { api, useApi } from "../api";

export interface AppPreferences {
  bytesStringBase2: boolean;
  defaultSnapshotViewAll: boolean;
  loaded: boolean;
}

const DEFAULTS: AppPreferences = { bytesStringBase2: false, defaultSnapshotViewAll: false, loaded: false };

const PreferencesContext = createContext<AppPreferences>(DEFAULTS);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { data, error } = useApi((signal) => api.uiPreferences.get({ signal }), []);
  const value: AppPreferences = {
    bytesStringBase2: !!data?.bytesStringBase2,
    defaultSnapshotViewAll: !!data?.defaultSnapshotViewAll,
    loaded: !!data || !!error,
  };
  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences(): AppPreferences {
  return use(PreferencesContext);
}
