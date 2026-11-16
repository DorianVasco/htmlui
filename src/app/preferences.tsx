// Server-side UI preferences (/api/v1/ui-preferences), shared with the old UI.
// The new UI reads and writes only the fields it uses. Saving re-reads the
// stored object and merges into it, so fields owned by the old UI (theme,
// fontSize, pageSize, …) are kept. The color scheme is not stored here: the old
// UI's theme values differ from Mantine's, so the new UI keeps it in localStorage.
import React, { createContext, ReactNode, use, useCallback, useMemo } from "react";
import { api, useApi } from "../api";
import type { UIPreferencesPayload } from "../api";

export interface AppPreferences {
  bytesStringBase2: boolean;
  defaultSnapshotViewAll: boolean;
  loaded: boolean;
  /** Saves the given fields, keeping everything else stored on the server. */
  save: (changes: Partial<Pick<AppPreferences, "bytesStringBase2" | "defaultSnapshotViewAll">>) => Promise<void>;
}

const DEFAULTS: AppPreferences = {
  bytesStringBase2: false,
  defaultSnapshotViewAll: false,
  loaded: false,
  save: async () => {},
};

const PreferencesContext = createContext<AppPreferences>(DEFAULTS);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { data, error, refresh } = useApi((signal) => api.uiPreferences.get({ signal }), []);

  const save = useCallback<AppPreferences["save"]>(
    async (changes) => {
      const stored: UIPreferencesPayload = (await api.uiPreferences.get()) ?? {};
      await api.uiPreferences.save({ ...stored, ...changes });
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<AppPreferences>(
    () => ({
      bytesStringBase2: !!data?.bytesStringBase2,
      defaultSnapshotViewAll: !!data?.defaultSnapshotViewAll,
      loaded: !!data || !!error,
      save,
    }),
    [data, error, save],
  );
  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences(): AppPreferences {
  return use(PreferencesContext);
}
