// Clickable design prototype for the new Kopia UI (Mantine).
// Runs on mock data only – no Kopia server required. Open /prototype.html.
import "@mantine/core/styles.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { theme } from "./theme";
import { PrototypeApp } from "./PrototypeApp";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <PrototypeApp />
    </MantineProvider>
  </React.StrictMode>,
);
