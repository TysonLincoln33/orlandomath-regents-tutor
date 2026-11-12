export function safeReturnPath(value: string | null | undefined) {
  // Only allow known local course routes; never redirect to a supplied origin.
  if (value && /^(?:\/|\/dashboard|\/geometry|\/(?:chapter|section)\/(?:geo-)?ch\d+(?:_s\d+)?)$/.test(value)) return value;
  return "/";
}
export function loginReturnPath() { return typeof window === "undefined" ? "/" : safeReturnPath(new URLSearchParams(window.location.search).get("next")); }
