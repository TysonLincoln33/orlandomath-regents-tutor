import { getSupabaseBrowserClient } from "../supabase/client";

type AttemptPayload = {
  courseId: string;
  chapterId: string;
  sectionId: string;
  questionId: string;
  selectedAnswer: string;
  correct: boolean;
  sectionTotalQuestions: number;
};

export async function recordQuestionAttempt(payload: AttemptPayload) {
  console.log("[recordQuestionAttempt] payload:", payload);

  const supabase: any = getSupabaseBrowserClient();

  let user = null;
  let userError = null;

  try {
    const result = await supabase.auth.getUser();
    user = result?.data?.user ?? null;
    userError = result?.error ?? null;
  } catch (err) {
    console.warn("[recordQuestionAttempt] auth lookup threw:", err);
    return;
  }

  console.log("[recordQuestionAttempt] user:", user);
  console.log("[recordQuestionAttempt] userError:", userError);

  if (userError || !user) {
    console.warn("[recordQuestionAttempt] No logged-in user found. Skipping RPC.");
    return;
  }

  const { error } = await supabase.rpc(
    "record_question_attempt_and_update_progress",
    {
      p_course_id: payload.courseId,
      p_chapter_id: payload.chapterId,
      p_section_id: payload.sectionId,
      p_question_id: payload.questionId,
      p_selected_answer: payload.selectedAnswer,
      p_correct: payload.correct,
      p_section_total_questions: payload.sectionTotalQuestions,
    }
  );

  console.log("[recordQuestionAttempt] rpc error:", error);

  if (error) {
    console.error("Autosave attempt/progress RPC failed", error);
    throw error;
  }
}