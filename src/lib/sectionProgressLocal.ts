import type { SectionStatus } from "@/lib/progressLocal";
import { getSectionStatus, setSectionStatus } from "@/lib/progressLocal";
import { emitProgressUpdated } from "@/lib/progress/events";

const KEY = "orlandomath:sectionProgress:v1";

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

export type QuestionProgress = {
  attempts: number;
  // sticky mastery: once correct, stays correct until explicitly reset
  correct: boolean;
  lastAnswerIndex?: number;
  lastAttemptAt: string; // ISO timestamp
};

export type SectionProgress = {
  sectionId: string;
  total: number;
  answered: number; // attempted at least once
  correct: number; // mastered
  byQuestionId: Record<string, QuestionProgress>;
  updatedAt: string; // ISO timestamp
};

type Store = Record<string, SectionProgress>;

function safeRead(): Store {
  if (!isBrowser()) return {};

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    return parsed as Store;
  } catch {
    return {};
  }
}

function safeWrite(next: Store): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore quota/privacy failures
  }
}

function recalc(progress: SectionProgress): SectionProgress {
  const byQ = progress.byQuestionId ?? {};
  const answered = Object.keys(byQ).length;
  const correct = Object.values(byQ).filter((q) => q.correct).length;

  return {
    ...progress,
    answered,
    correct,
    updatedAt: new Date().toISOString(),
  };
}

export function getSectionProgress(
  sectionId: string,
  totalQuestions?: number
): SectionProgress | null {
  const store = safeRead();
  const existing = store[sectionId] ?? null;

  if (!existing) return null;

  // if question count changed, keep progress structurally valid
  if (
    typeof totalQuestions === "number" &&
    totalQuestions >= 0 &&
    existing.total !== totalQuestions
  ) {
    const patched = recalc({
      ...existing,
      total: totalQuestions,
    });

    store[sectionId] = patched;
    safeWrite(store);
    syncLegacyStatus(sectionId, patched);
    emitProgressUpdated();

    return patched;
  }

  return existing;
}

export function ensureSectionProgress(
  sectionId: string,
  totalQuestions: number
): SectionProgress {
  const store = safeRead();
  const existing = store[sectionId];

  if (existing) {
    return getSectionProgress(sectionId, totalQuestions) ?? existing;
  }

  const fresh: SectionProgress = {
    sectionId,
    total: totalQuestions,
    answered: 0,
    correct: 0,
    byQuestionId: {},
    updatedAt: new Date().toISOString(),
  };

  store[sectionId] = fresh;
  safeWrite(store);
  syncLegacyStatus(sectionId, fresh);
  emitProgressUpdated();

  return fresh;
}

export function recordAttempt(opts: {
  sectionId: string;
  questionId: string;
  isCorrect: boolean;
  answerIndex?: number;
  totalQuestions: number;
}): SectionProgress {
  const { sectionId, questionId, isCorrect, answerIndex, totalQuestions } =
    opts;

  const store = safeRead();
  const current = store[sectionId] ?? ensureSectionProgress(sectionId, totalQuestions);

  const byQ = { ...(current.byQuestionId ?? {}) };
  const prev = byQ[questionId];
  const nowIso = new Date().toISOString();

  const nextQ: QuestionProgress = {
    attempts: (prev?.attempts ?? 0) + 1,
    correct: prev?.correct ? true : isCorrect,
    lastAnswerIndex: answerIndex,
    lastAttemptAt: nowIso,
  };

  byQ[questionId] = nextQ;

  const next = recalc({
    sectionId,
    total: totalQuestions,
    answered: current.answered,
    correct: current.correct,
    byQuestionId: byQ,
    updatedAt: nowIso,
  });

  store[sectionId] = next;
  safeWrite(store);
  syncLegacyStatus(sectionId, next);
  emitProgressUpdated();

  return next;
}

export function resetQuestionProgress(opts: {
  sectionId: string;
  questionId: string;
  totalQuestions: number;
}): SectionProgress {
  const { sectionId, questionId, totalQuestions } = opts;

  const store = safeRead();
  const current = store[sectionId] ?? ensureSectionProgress(sectionId, totalQuestions);

  const byQ = { ...(current.byQuestionId ?? {}) };

  if (byQ[questionId]) {
    delete byQ[questionId];
  }

  const next = recalc({
    sectionId,
    total: totalQuestions,
    answered: 0,
    correct: 0,
    byQuestionId: byQ,
    updatedAt: new Date().toISOString(),
  });

  store[sectionId] = next;
  safeWrite(store);
  syncLegacyStatus(sectionId, next);
  emitProgressUpdated();

  return next;
}

export function resetSectionProgress(sectionId: string): void {
  const store = safeRead();

  if (store[sectionId]) {
    delete store[sectionId];
    safeWrite(store);
  }

  try {
    setSectionStatus(sectionId, "not_started");
    emitProgressUpdated();
  } catch {
    // ignore
  }
}

export function deriveSectionStatus(progress: SectionProgress): SectionStatus {
  if (!progress || progress.correct <= 0) return "not_started";
  if (progress.correct < progress.total) return "in_progress";
  return "complete";
}

function syncLegacyStatus(sectionId: string, progress: SectionProgress): void {
  try {
    const status = deriveSectionStatus(progress);
    setSectionStatus(sectionId, status);
  } catch {
    // ignore
  }
}

export function getSectionPercent(
  sectionId: string,
  fallbackTotalQuestions?: number
): number {
  const progress = getSectionProgress(sectionId, fallbackTotalQuestions);

  if (progress && progress.total > 0) {
    return Math.round((progress.correct / progress.total) * 100);
  }

  const status = getSectionStatus(sectionId);
  if (status === "complete") return 100;
  if (status === "in_progress") return 50;
  return 0;
}

export function getAveragePercent(sectionIds: string[]): number {
  if (sectionIds.length === 0) return 0;

  const total = sectionIds.reduce((sum, id) => {
    return sum + getSectionPercent(id);
  }, 0);

  return Math.round(total / sectionIds.length);
}