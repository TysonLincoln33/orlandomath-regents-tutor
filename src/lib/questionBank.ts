// Local question bank loader for Step 12 / Step 14.
//
// Canonical location for JSON (production-safe):
//   /public/questions/sections/{sectionId}.json
//
// Why fetch() instead of dynamic import?
// - Next build can't statically analyze `import(`...${id}.json`)`.
// - fetch() from /public works in dev + prod + Vercel and doesn't touch bundling.

export type MCQuestion = {
  id: string;
  type: "mc";
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
  difficulty?: number;
  tags?: string[];
};

export type SectionLesson = {
  title?: string;
  intro?: string[];
  exampleTitle?: string;
  examplePrompt?: string;
  exampleSteps?: string[];
};

export type SectionQuestionSet = {
  sectionId: string;
  title?: string;
  lesson?: SectionLesson;
  questions: MCQuestion[];
};

export async function getSectionQuestionSet(sectionId: string): Promise<SectionQuestionSet | null> {
  if (!sectionId) return null;

  try {
    const url = `/questions/sections/${encodeURIComponent(sectionId)}.json`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) return null;

    const data = (await res.json()) as SectionQuestionSet;
    if (data?.sectionId && Array.isArray(data?.questions)) return data;

    return null;
  } catch {
    return null;
  }
}
