// ─── GATEForge TypeScript Interfaces ────────────────────────────────────────

export interface MockSet {
  id: string;
  set_number: number;
  title: string;
  total_questions: number;
  total_marks: number;
  generated_date: string;
  subject_breakdown: Record<string, number> | null;
}

export interface Question {
  id: string;
  subject: string;
  topic: string;
  question_text: string;
  question_type: "MCQ" | "MSQ" | "NAT";
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  negative_marks: number;
  options: Record<string, string> | null; // { A: "...", B: "...", C: "...", D: "..." }
  diagram: string | null; // Mermaid or SVG
  diagram_type: string | null;
  needs_image?: boolean;
  image_html?: string | null;
}

export interface PaperResponse {
  setNumber: number;
  totalQuestions: number;
  totalMarks: number;
  timeLimit: number; // minutes
  questions: Question[];
}

export interface AttemptStartResponse {
  attemptId: string;
  startedAt: string;
  expiresAt: string;
  resumed: boolean;
}

export interface SubjectBreakdown {
  subject: string;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  marksScored: number;
  totalMarks: number;
}

export interface QuestionResult {
  id: string;
  subject: string;
  topic?: string;
  question_text: string;
  question_type: "MCQ" | "MSQ" | "NAT";
  marks: number;
  options: Record<string, string> | null;
  diagram: string | null;
  userAnswer: string | null;
  correct_answer: string;
  explanation: string;
  isCorrect: boolean;
  isSkipped: boolean;
  marksAwarded: number;
  needs_image?: boolean;
  image_html?: string | null;
  key_refs?: string[];
  youtube_queries?: string[];
}

export interface SubmitResponse {
  attemptId: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  subjectBreakdown: SubjectBreakdown[];
  questionsWithAnswers: QuestionResult[];
}

export interface Attempt {
  id: string;
  browser_id: string;
  set_number: number;
  attempt_date: string;
  status: "in_progress" | "completed" | "expired";
  started_at: string;
  completed_at: string | null;
  time_taken_secs: number | null;
  score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  skipped_count: number | null;
  answers: Record<string, string> | null;
}

export type QuestionStatus = "not_visited" | "current" | "answered" | "marked" | "answered_marked";

export interface QuestionAnalysis {
  id: string;
  concept: string;
  why_wrong: string;
  correct_explanation: string;
  key_refs: string[];
  youtube_queries: string[];
}
