import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

async function start() {
  // Dev only: ?mock=1 serves fake API data (no Kopia server needed), ?mock=0 turns it off.
  if (import.meta.env.DEV) {
    const { devMockMode } = await import("./devMockFlag");
    const mode = devMockMode();
    if (mode) {
      const { installDevMock } = await import("./devMock");
      await installDevMock(mode);
    }
  }

  createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void start();
