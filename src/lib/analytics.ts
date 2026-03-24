import { getAttribution } from "@/lib/attribution";

export type TrackEventName =
  | "save_progress_opened"
  | "save_progress_submitted"
  | "save_progress_success"
  | "save_progress_error"
  | "resume_success"
  | "resume_error"
  | "diagnostic_started"
  | "diagnostic_completed"
  | "book_clicked"
  | "book_viewed";

export type TrackEventPayload = Record<string, unknown>;

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export async function trackEvent(name: TrackEventName, payload: TrackEventPayload = {}) {
  if (typeof window === "undefined") return;

  const attribution = getAttribution();
  const eventBody = {
    name,
    ts: new Date().toISOString(),
    path: window.location.pathname,
    href: window.location.href,
    referrer: document.referrer || undefined,
    attribution,
    payload,
  };

  // 1) GA4 if present
  if (window.gtag) {
    try {
      window.gtag("event", name, payload);
    } catch {
      // ignore
    }
  }

  // 2) Server-side log endpoint (safe default)
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventBody),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}
