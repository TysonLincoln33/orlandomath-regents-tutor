export type Attribution = {
  firstTouch?: {
    ts: string;
    href: string;
    referrer?: string;
    utm?: Record<string, string>;
    clickIds?: Record<string, string>;
  };
  lastTouch?: {
    ts: string;
    href: string;
    referrer?: string;
    utm?: Record<string, string>;
    clickIds?: Record<string, string>;
  };
};

const KEY = "rt_attribution_v1";

function safeParse(raw: string | null): Attribution {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Attribution;
  } catch {
    return {};
  }
}

function nowIso() {
  return new Date().toISOString();
}

function pickParams(params: URLSearchParams, keys: string[]) {
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = params.get(k);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function captureAttributionFromUrl() {
  if (typeof window === "undefined") return;

  const href = window.location.href;
  const referrer = document.referrer || undefined;
  const params = new URL(href).searchParams;

  const utm = pickParams(params, [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ]);

  const clickIds = pickParams(params, ["gclid", "fbclid", "msclkid"]);

  const existing = safeParse(localStorage.getItem(KEY));
  const lastTouch = { ts: nowIso(), href, referrer, utm, clickIds };

  const next: Attribution = {
    ...existing,
    lastTouch,
    firstTouch: existing.firstTouch ?? lastTouch,
  };

  localStorage.setItem(KEY, JSON.stringify(next));
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  return safeParse(localStorage.getItem(KEY));
}
