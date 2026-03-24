"use client";

import * as React from "react";
import SaveProgressModal from "@/components/SaveProgressModal";

/**
 * Save My Progress Floating Action Button (FAB)
 */
export default function SaveMyProgressFab() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-auto md:bottom-6 md:right-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-xl ring-1 ring-blue-300/40 transition hover:bg-blue-700 hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          aria-label="Save My Progress"
        >
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20"
            aria-hidden="true"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 21H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 .59-1.41l2.5-2.5A2 2 0 0 1 7.5 3H17a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M8 21v-7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M7 3v5h10V3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <span className="tracking-wide">Save My Progress</span>
        </button>
      </div>

      <SaveProgressModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
