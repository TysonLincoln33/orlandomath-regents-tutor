import { CHAPTERS, SECTIONS } from "@/lib/course/algebra1";
import { safeGetItem, safeRemoveItem, safeSetItem } from "@/lib/progress/storage";
import { emitProgressUpdated } from "@/lib/progress/events";

export type SectionStatus = "not_started" | "in_progress" | "complete";

export type ProgressStateV1 = {
  // sectionId -> status
  sections: Record<string, SectionStatus>;
  updatedAt: number; // unix ms
};

const KEY = "rt_progress_v1";

export function getProgress(): ProgressStateV1 {
  const raw = safeGetItem(KEY);
  if (!raw) return { sections: {}, updatedAt: Date.now() };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("bad");
    return {
      sections: parsed.sections ?? {},
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return { sections: {}, updatedAt: Date.now() };
  }
}

export function setProgress(next: ProgressStateV1) {
  safeSetItem(KEY, JSON.stringify({ ...next, updatedAt: Date.now() }));
  emitProgressUpdated();
}

export function resetProgress() {
  safeRemoveItem(KEY);
  emitProgressUpdated();
}

export function getSectionStatus(sectionId: string): SectionStatus {
  const p = getProgress();
  return (p.sections?.[sectionId] as SectionStatus) ?? "not_started";
}

export function setSectionStatus(sectionId: string, status: SectionStatus) {
  const p = getProgress();
  p.sections = p.sections ?? {};
  p.sections[sectionId] = status;
  setProgress(p);
}

export function getChapterCompletion(chapterId: string): number {
  const secs = SECTIONS.filter((s) => s.chapterId === chapterId);
  if (secs.length === 0) return 0;
  const p = getProgress();
  const done = secs.filter((s) => (p.sections?.[s.id] ?? "not_started") === "complete").length;
  return Math.round((done / secs.length) * 100);
}

export function getGlobalCompletion(): number {
  if (SECTIONS.length === 0) return 0;
  const p = getProgress();
  const done = SECTIONS.filter((s) => (p.sections?.[s.id] ?? "not_started") === "complete").length;
  return Math.round((done / SECTIONS.length) * 100);
}

export function getChapterStatusCounts(chapterId: string) {
  const secs = SECTIONS.filter((s) => s.chapterId === chapterId);
  const p = getProgress();
  const counts = { not_started: 0, in_progress: 0, complete: 0 } as Record<SectionStatus, number>;
  for (const s of secs) {
    const st = (p.sections?.[s.id] ?? "not_started") as SectionStatus;
    counts[st] = (counts[st] ?? 0) + 1;
  }
  return counts;
}

export function getNextSectionInChapter(chapterId: string): string | null {
  const secs = SECTIONS.filter((s) => s.chapterId === chapterId).sort((a, b) => a.sectionNumber - b.sectionNumber);
  const p = getProgress();
  const firstNotComplete = secs.find((s) => (p.sections?.[s.id] ?? "not_started") !== "complete");
  return firstNotComplete?.id ?? (secs[0]?.id ?? null);
}
