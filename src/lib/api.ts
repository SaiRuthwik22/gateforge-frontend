// ─── API Client ─────────────────────────────────────────────────────────────

import type {
  MockSet,
  PaperResponse,
  AttemptStartResponse,
  SubmitResponse,
  Attempt,
  QuestionResult,
  QuestionAnalysis,
} from "./types";

const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Sets ───────────────────────────────────────────────────────────────────

export async function fetchSets(): Promise<MockSet[]> {
  const data = await request<{ sets: MockSet[] }>("/sets");
  return data.sets;
}

export async function fetchPaper(setNumber: number): Promise<PaperResponse> {
  return request<PaperResponse>(`/paper/${setNumber}`);
}

// ─── Attempts ───────────────────────────────────────────────────────────────

export async function startAttempt(
  setNumber: number
): Promise<AttemptStartResponse> {
  return request<AttemptStartResponse>("/attempts/start", {
    method: "POST",
    body: JSON.stringify({ setNumber }),
  });
}

export async function saveProgress(
  attemptId: string,
  answers: Record<string, string>,
  lastQuestionIndex: number,
  timeTakenSeconds: number
): Promise<void> {
  await request(`/attempts/${attemptId}/progress`, {
    method: "PATCH",
    body: JSON.stringify({ answers, lastQuestionIndex, timeTakenSeconds }),
  });
}

export async function submitAttempt(
  setNumber: number,
  answers: Record<string, string>,
  timeTakenSeconds: number
): Promise<SubmitResponse> {
  return request<SubmitResponse>("/submit", {
    method: "POST",
    body: JSON.stringify({ setNumber, answers, timeTakenSeconds }),
  });
}

export async function fetchAttempts(): Promise<Attempt[]> {
  const data = await request<{ attempts: Attempt[] }>("/attempts");
  return data.attempts;
}

export async function sendChatMessage(
  questionContext: QuestionResult,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<{ reply: string }> {
  return request<{ reply: string }>("/chat", {
    method: "POST",
    body: JSON.stringify({ questionContext, messages }),
  });
}
