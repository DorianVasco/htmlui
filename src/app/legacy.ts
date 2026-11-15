// Links to pages that are not ported to the new UI yet. They point at the old
// UI's routes (outside the /ui basename), so they must be rendered as plain
// <a href>, never as router <Link>. When a page is ported, replace its helper
// here with a router path – this file is the single switch-over point.
import { sourceQuery } from "../api";
import type { PolicyTarget } from "../api";

export const legacy = {
  policy: (target: PolicyTarget) => "/policies/edit?" + sourceQuery(target),
  policies: () => "/policies",
  /** Classic repository setup, still used for storage types the new UI doesn't support yet. */
  repository: () => "/repo",
  preferences: () => "/preferences",
};
