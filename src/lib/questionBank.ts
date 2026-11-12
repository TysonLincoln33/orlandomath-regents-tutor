export type ProofCell = { kind: "fixed"; text: string } | { kind: "dropdown"; choices: string[]; answerIndex: number };
export type ProofRow = { id: string; statement: ProofCell; reason: ProofCell };
type QuestionBase = { id: string; prompt: string; image?: string; imageAlt?: string; sourceNumber?: number; explanation?: string; hint?: string; difficulty?: number; tags?: string[]; table?: { headers: string[]; rows: string[][] } };
export type MCQuestion = QuestionBase & { type: "mc"; choices: string[]; answerIndex: number; choiceImages?: string[]; originalChoiceLabels?: boolean };
export type ProofQuestion = QuestionBase & { type: "proof_dropdown"; proof: { rows: ProofRow[]; masteryRule: "all_dropdowns_correct"; countAsQuestions: 1 } };
export type Question = MCQuestion | ProofQuestion;
export type ProofAnswer = Record<string, number>;
export type QuestionAnswer = number | ProofAnswer;
export type SectionLesson = { title: string; intro: string[]; exampleTitle?: string; examplePrompt?: string; exampleSteps?: string[] };
export type SectionQuestionSet = { sectionId: string; courseId?: string; chapterId?: string; title: string; lesson?: SectionLesson; questions: Question[] };
export function gradeQuestion(question: Question, answer: QuestionAnswer | null | undefined) {
 // Existing Algebra JSON predates the type discriminator and is multiple choice.
 if (question.type !== "proof_dropdown") { const complete = typeof answer === "number" && Number.isInteger(answer) && answer >= 0 && answer < question.choices.length; return { complete, correct: complete && answer === question.answerIndex, answered: complete ? 1 : 0, correctCells: complete && answer === question.answerIndex ? 1 : 0, total: 1 }; }
 const selections = answer && typeof answer === "object" ? answer : {};
 const cells = question.proof.rows.flatMap(row => (["statement", "reason"] as const).flatMap(column => { const cell = row[column]; return cell.kind === "dropdown" ? [{ id: row.id + "." + column, cell }] : []; }));
 const answered = cells.filter(({id, cell}) => Number.isInteger(selections[id]) && selections[id] >= 0 && selections[id] < cell.choices.length).length;
 const correctCells = cells.filter(({id, cell}) => selections[id] === cell.answerIndex).length;
 const complete = cells.length > 0 && answered === cells.length;
 return { complete, correct: complete && correctCells === cells.length, answered, correctCells, total: cells.length };
}
export function serializeAnswer(answer: QuestionAnswer) { return typeof answer === "number" ? String(answer) : JSON.stringify(Object.fromEntries(Object.keys(answer).sort().map(key => [key, answer[key]]))); }
export async function getSectionQuestionSet(sectionId: string): Promise<SectionQuestionSet | null> {
 if (!/^(?:geo-)?ch\d+_s\d+$/.test(sectionId)) return null;
 try { const response = await fetch("/questions/sections/" + encodeURIComponent(sectionId) + ".json", {cache: "no-store"}); if (!response.ok) return null; const data = await response.json(); return data?.sectionId === sectionId && Array.isArray(data.questions) ? data : null; } catch { return null; }
}
