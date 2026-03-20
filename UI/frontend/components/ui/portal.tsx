"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, type ReactNode } from "react";

/**
 * Renders children directly into document.body via a React portal.
 * This ensures `position: fixed` descendants are always relative to
 * the viewport --- never broken by ancestor CSS transforms (e.g. Framer Motion).
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
