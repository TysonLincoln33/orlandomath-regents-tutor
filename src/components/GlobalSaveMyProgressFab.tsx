"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import SaveMyProgressFab from "@/components/SaveMyProgressFab";

/**
 * Shows the floating Save My Progress button everywhere EXCEPT the dashboard.
 * This supports Option A:
 * - Dashboard uses its own local header button/modal (already working)
 * - All other pages use the floating FAB/modal
 */
export default function GlobalSaveMyProgressFab() {
  const pathname = usePathname() || "";

  // Also hide on resume flow pages to avoid UI clutter during redirect
  if (pathname === "/resume" || pathname.startsWith("/resume/")) return null;

  return <SaveMyProgressFab />;
}
