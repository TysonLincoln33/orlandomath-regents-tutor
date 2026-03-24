"use client";

import * as React from "react";
import { captureAttributionFromUrl } from "@/lib/attribution";

/**
 * Captures UTMs/referrer on first load and updates "last touch" on every load.
 * This powers Step 9 lead context + analytics.
 */
export default function AttributionBootstrap() {
  React.useEffect(() => {
    captureAttributionFromUrl();
  }, []);

  return null;
}
