/*
  OrlandoMath local progress store (browser-only).
  This file exists to provide a SINGLE, stable API for the app.
  Vercel/Turbopack is strict: every imported symbol must be exported.

  IMPORTANT:
  - All functions here are safe to import from Client Components.
  - Any function that touches localStorage guards against SSR.
*/

import { emitProgressUpdated } from "@/lib/progress/events";

export type SectionStatus = "not_started" | "in_progress" | "complete";

type ProgressMap = Record<string, SectionStatus>;

type ChapterLike = string | { id: string };

const STORAGE_KEY = "orlandomath:progress:v1";
const SHOW_STANDARDS_KEY = "orlandomath:showStandards:v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeRead(): ProgressMap {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ProgressMap;
  } catch {
    return {};
  }
}

// Back-compat: some components import this name.
export function readLocalProgress(): ProgressMap {
  return safeRead();
}

function safeWrite(next: ProgressMap): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emitProgressUpdated();
  } catch {
    // ignore quota / privacy mode failures
  }
}

/** Returns the whole saved map (sectionId -> status). */
export function getProgress(): ProgressMap {
  return safeRead();
}

/** Back-compat alias used in some components. */
export function writeLocalProgress(sectionId: string, status: SectionStatus): void {
  setSectionStatus(sectionId, status);
}

export function getSectionStatus(sectionId: string): SectionStatus {
  const map = safeRead();
  return map[sectionId] ?? "not_started";
}

export function setSectionStatus(sectionId: string, status: SectionStatus): void {
  const map = safeRead();
  map[sectionId] = status;
  safeWrite(map);
}

export function clearLocalProgress(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    emitProgressUpdated();
  } catch {
    // ignore
  }
}

export function getShowStandards(): boolean {
  if (!isBrowser()) return false;
  try {
    const raw = window.localStorage.getItem(SHOW_STANDARDS_KEY);
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function setShowStandards(value: boolean): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(SHOW_STANDARDS_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

/**
 * Overall progress across ALL sections.
 * Uses dynamic import to avoid hard dependency if your course module paths differ.
 */
export function getOverallProgress(totalSections?: number): { completed: number; total: number; percent: number } {
  const map = safeRead();
  // We can't import your course data here without risking path mismatches.
  // So we compute using whatever has been touched so far.
  const ids = Object.keys(map);
  const observedTotal = ids.length;
  const total = typeof totalSections === "number" && totalSections > 0 ? totalSections : observedTotal;
  const completed = ids.filter((id) => map[id] === "complete").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

/**
 * Chapter completion. If your app has a fixed list of section ids per chapter,
 * prefer passing an array of sectionIds and computing in the component.
 * This helper supports either a chapterId string or an object with {id}.
 */
export function getChapterCompletion(
  chapter: ChapterLike,
  sectionIds?: string[]
): { completed: number; total: number; percent: number } {
  const chapterId = typeof chapter === "string" ? chapter : chapter?.id;
  const map = safeRead();

  // Prefer explicit ids when provided.
  const ids = Array.isArray(sectionIds) && sectionIds.length > 0
    ? sectionIds
    : Object.keys(map).filter((id) => (chapterId ? id.startsWith(chapterId + "_") || id.startsWith(chapterId) : false));

  const total = ids.length;
  const completed = ids.filter((id) => map[id] === "complete").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

