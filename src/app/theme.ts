import { createTheme, MantineColorsTuple } from "@mantine/core";

/** Kopia logo blue (#2a7fff, public/kopia-flat.svg) at index 6, with lighter tints and darker shades. */
export const kopiaBlue: MantineColorsTuple = [
  "#eef5ff",
  "#d9e8ff",
  "#b4d2ff",
  "#90bcff",
  "#6aa5ff",
  "#4891ff",
  "#2a7fff",
  "#2570e0",
  "#205fbf",
  "#1a4f9e",
];

export const theme = createTheme({
  colors: { kopia: kopiaBlue },
  primaryColor: "kopia",
  // Logo blue in light mode; one step darker in dark mode for calmer filled buttons.
  primaryShade: { light: 6, dark: 7 },
  defaultRadius: "md",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  headings: { fontWeight: "650" },
  components: {
    Card: { defaultProps: { withBorder: true, padding: "lg" } },
    Table: { defaultProps: { verticalSpacing: "sm", highlightOnHover: true } },
  },
});
