"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import SaveProgressModal from "@/components/SaveProgressModal";

/**
 * Shows a page-level "Save My Progress" button (NOT in the top blue banner)
 * on every page (except resume pages).
 */
export default function GlobalSaveMyProgressBar() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname() || "";

  // Hide on resume flow pages to avoid UI clutter during redirect
  if (pathname === "/resume" || pathname.startsWith("/resume/")) return null;

  return (
    <>
      <div className="om-page-savebar">
        <div className="om-page-savebar-inner">
          <button
            type="button"
            className="om-btn om-btn-primary"
            onClick={() => setOpen(true)}
            title="Save your progress and get a resume link"
          >
            Save My Progress
          </button>
        </div>
      </div>

      <SaveProgressModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
