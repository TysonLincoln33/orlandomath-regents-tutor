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

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("[recordQuestionAttempt] user:", user);
  console.log("[recordQuestionAttempt] userError:", userError);

  if (userError) {
    console.error("[recordQuestionAttempt] user lookup failed:", userError);
    throw userError;
  }

  if (!user) {
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