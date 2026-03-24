import { safeGetItem, safeSetItem } from "@/lib/progress/storage";

const KEY = "rt_show_standards_v1";

export function getShowStandards(): boolean {
  const raw = safeGetItem(KEY);
  if (!raw) return false; // default OFF
  return raw === "1" || raw === "true";
}

export function setShowStandards(next: boolean) {
  safeSetItem(KEY, next ? "1" : "0");
}
