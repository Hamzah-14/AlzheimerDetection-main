"use client";

import { useEffect } from "react";

const SUFFIX = "Synapse.PL";

/**
 * Sets document.title for the current page.
 * Call with just the page name, e.g. usePageTitle("Dashboard").
 * Renders as "Dashboard · Synapse.PL" in the browser tab.
 */
export function usePageTitle(page: string) {
  useEffect(() => {
    document.title = `${page} · ${SUFFIX}`;
    return () => {
      document.title = SUFFIX;
    };
  }, [page]);
}
