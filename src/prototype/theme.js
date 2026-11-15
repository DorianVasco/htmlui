import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "teal",
  defaultRadius: "md",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  headings: { fontWeight: "650" },
  components: {
    Card: { defaultProps: { withBorder: true, padding: "lg" } },
    Table: { defaultProps: { verticalSpacing: "sm", highlightOnHover: true } },
  },
});
