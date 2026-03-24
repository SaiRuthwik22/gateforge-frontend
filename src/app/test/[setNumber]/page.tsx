"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Question, QuestionStatus } from "@/lib/types";
import { fetchPaper, startAttempt, saveProgress, submitAttempt } from "@/lib/api";
import { formatTime } from "@/lib/cookies";

export default function TestPage() {
  const params = useParams();
  const router = useRouter();
  const setNumber = parseInt(params.setNumber as string, 10);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(180 * 60);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(`Loading Set ${setNumber}...`);
  const [error, setError] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fullscreen on mount ────────────────────────────────────────────────
  useEffect(() => {
    const requestFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fullscreen may be denied by browser — continue without it
      }
    };
    requestFullscreen();
  }, []);

  // ─── Load paper and start attempt (with retry for Cold Start) ───────────
  const initTest = useCallback(async () => {
    let attempts = 0;
    const maxAttempts = 10; // Up to ~30 seconds of retrying

    while (attempts < maxAttempts) {
      try {
        const [paper, attempt] = await Promise.all([
          fetchPaper(setNumber),
          startAttempt(setNumber),
        ]);

        setQuestions(paper.questions);
        setAttemptId(attempt.attemptId);

        if (attempt.resumed && attempt.startedAt) {
          const elapsed = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
          setTimeLeft(Math.max(0, 180 * 60 - elapsed));
        }

        if (paper.questions.length > 0) {
          setVisited(new Set([paper.questions[0].id]));
        }

        setLoading(false);
        return; // Success, exit retry loop
      } catch (err: unknown) {
        attempts++;
        if (attempts >= maxAttempts) {
          const message = err instanceof Error ? err.message : "Failed to load test after multiple retries";
          setError(message);
          setLoading(false);
          return;
        }
        
        // Update UI to let user know we are waiting
        setLoadingMessage(
          attempts > 2 
            ? "Waking up database... this may take up to 30 seconds." 
            : `Loading Set ${setNumber}...`
        );
        
        // Wait 3 seconds before retrying
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }, [setNumber]);

  useEffect(() => { initTest(); }, [initTest]);

  // ─── Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); handleAutoSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ─── Autosave every 30 seconds ──────────────────────────────────────────
  useEffect(() => {
    if (!attemptId || loading) return;
    autosaveRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      saveProgress(attemptId, answers, currentIndex, elapsed).catch(console.error);
    }, 30_000);
    return () => { if (autosaveRef.current) clearInterval(autosaveRef.current); };
  }, [attemptId, answers, currentIndex, loading]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const currentQ = questions[currentIndex];

  function goToQuestion(index: number) {
    setCurrentIndex(index);
    if (questions[index]) setVisited((prev) => new Set(prev).add(questions[index].id));
  }

  function selectAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function toggleMSQOption(questionId: string, option: string) {
    setAnswers((prev) => {
      const current = prev[questionId] || "";
      const selected = current ? current.split(",") : [];
      const newSelected = selected.includes(option)
        ? selected.filter((o) => o !== option)
        : [...selected, option];
      return { ...prev, [questionId]: newSelected.join(",") };
    });
  }

  function clearResponse() {
    if (!currentQ) return;
    setAnswers((prev) => { const copy = { ...prev }; delete copy[currentQ.id]; return copy; });
  }

  function toggleMark() {
    if (!currentQ) return;
    setMarked((prev) => {
      const copy = new Set(prev);
      if (copy.has(currentQ.id)) copy.delete(currentQ.id);
      else copy.add(currentQ.id);
      return copy;
    });
  }

  function getQuestionStatus(q: Question, index: number): QuestionStatus {
    if (index === currentIndex) return "current";
    const isAnswered = !!answers[q.id];
    const isMarked = marked.has(q.id);
    if (isAnswered && isMarked) return "answered_marked";
    if (isMarked) return "marked";
    if (isAnswered) return "answered";
    if (visited.has(q.id)) return "visited_unanswered";
    return "not_visited";
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const result = await submitAttempt(setNumber, answers, elapsed);
      localStorage.setItem(`gateforge_result_${result.attemptId}`, JSON.stringify(result));
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      router.push(`/results/${result.attemptId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Submit failed";
      alert(message);
      setSubmitting(false);
    }
  }

  async function handleAutoSubmit() {
    const elapsed = 180 * 60;
    try {
      const result = await submitAttempt(setNumber, answers, elapsed);
      localStorage.setItem(`gateforge_result_${result.attemptId}`, JSON.stringify(result));
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      router.push(`/results/${result.attemptId}`);
    } catch {
      alert("Time expired. Failed to auto-submit. Please try refreshing.");
    }
  }

  const answeredCount = Object.keys(answers).length;
  const markedCount = marked.size;
  const skippedCount = questions.length - answeredCount;

  // ─── Loading / Error states ─────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--color-background)" }}>
        <div style={{ textAlign: "center", maxWidth: "400px", padding: "0 20px" }}>
          <div className="skeleton" style={{ width: "200px", height: "24px", margin: "0 auto 16px" }} />
          <p style={{ color: "var(--color-primary)", fontWeight: 600, marginBottom: "8px" }}>{loadingMessage}</p>
          {loadingMessage.includes("database") && (
            <p style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>
              Our systems are powering on to fetch your questions. Please do not refresh the page.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--color-background)" }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <p style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</p>
          <h2 style={{ marginBottom: "8px" }}>Cannot Load Test</h2>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "24px" }}>{error}</p>
          <button className="btn btn-primary" onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); router.push("/"); }}>Back to Home</button>
        </div>
      </div>
    );
  }

  if (!currentQ) return null;

  const isDanger = timeLeft < 300;

  return (
    <div className="test-fullscreen">
      {/* ─── Timer Bar ────────────────────────────────────────────────────── */}
      <div className="timer-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="btn btn-ghost" onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); router.push("/"); }} style={{ fontSize: "13px" }}>
            ← Exit
          </button>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
            Set {setNumber}
          </span>
          <span className="badge badge-primary">Q {currentIndex + 1} / {questions.length}</span>
        </div>

        <div className={`timer-display${isDanger ? " danger" : ""}`}>
          ⏱ {formatTime(timeLeft)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="badge badge-success">{answeredCount} answered</span>
          <span className="badge badge-warning">{markedCount} marked</span>
        </div>
      </div>

      {/* ─── Main Content: Question (left) + Navigator (right) ──────────── */}
      <div className="test-main-area">

        {/* ─── Question Panel (left) ──────────────────────────────────── */}
        <div className="test-question-panel">
          {/* Question header */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-primary)" }}>
              {currentQ.subject}
            </span>
            <span style={{ fontSize: "12px", color: "var(--color-text-tertiary)" }}>•</span>
            <span className={`badge ${currentQ.difficulty === "easy" ? "badge-success" : currentQ.difficulty === "medium" ? "badge-warning" : "badge-danger"}`}>
              {currentQ.difficulty}
            </span>
            <span className="badge badge-neutral">{currentQ.question_type}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Question {currentIndex + 1}</h2>
            <div style={{ display: "flex", gap: "8px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
              <span>+{currentQ.marks} marks</span>
              {currentQ.question_type === "MCQ" && (
                <span style={{ color: "var(--color-danger)" }}>
                  −{currentQ.negative_marks || (currentQ.marks === 1 ? 0.33 : 0.67)}
                </span>
              )}
            </div>
          </div>

          {/* Question text */}
          {currentQ.needs_image && currentQ.image_html ? (
            <div style={{ fontSize: "16px", lineHeight: "1.8", marginBottom: "28px" }} dangerouslySetInnerHTML={{ __html: currentQ.image_html }} />
          ) : (
            <div style={{ fontSize: "16px", lineHeight: "1.8", marginBottom: "28px", whiteSpace: "pre-wrap" }}>
              {currentQ.question_text}
            </div>
          )}

          {/* Diagram */}
          {currentQ.diagram && typeof currentQ.diagram === "object" && (currentQ.diagram as {type:string;data:string}).data && (
            <div style={{ marginBottom: "24px", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--color-border)" }}>
              <div style={{ padding: "6px 14px", background: "var(--color-primary)", color: "#fff", fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {(currentQ.diagram as {type:string;data:string}).type || "Diagram"}
              </div>
              <pre style={{ padding: "16px", margin: 0, background: "var(--color-section)", fontSize: "13px", fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", overflowX: "auto", lineHeight: "1.6" }}>
                {(currentQ.diagram as {type:string;data:string}).data}
              </pre>
            </div>
          )}

          {/* ─── Answer Input ──────────────────────────────────────── */}
          {currentQ.question_type === "MCQ" && currentQ.options && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Object.entries(currentQ.options).map(([key, value]) => (
                <button key={key} className={`option-btn${answers[currentQ.id] === key ? " selected" : ""}`} onClick={() => selectAnswer(currentQ.id, key)}>
                  <span className="option-label">{key}</span>
                  <span>{value}</span>
                </button>
              ))}
            </div>
          )}

          {currentQ.question_type === "MSQ" && currentQ.options && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>Select one or more correct answers:</p>
              {Object.entries(currentQ.options).map(([key, value]) => {
                const selected = (answers[currentQ.id] || "").split(",").includes(key);
                return (
                  <button key={key} className={`option-btn${selected ? " selected" : ""}`} onClick={() => toggleMSQOption(currentQ.id, key)}>
                    <span className="checkbox-label">{selected ? "✓" : ""}</span>
                    <span><strong>{key}.</strong> {value}</span>
                  </button>
                );
              })}
            </div>
          )}

          {currentQ.question_type === "NAT" && (
            <div>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginBottom: "8px" }}>Enter your numerical answer:</p>
              <input type="number" step="any" className="nat-input" placeholder="Type your answer..." value={answers[currentQ.id] || ""} onChange={(e) => selectAnswer(currentQ.id, e.target.value)} />
              <p style={{ fontSize: "12px", color: "var(--color-text-tertiary)", marginTop: "6px" }}>No negative marking for NAT questions.</p>
            </div>
          )}

          {/* ─── Controls ──────────────────────────────────────────── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "36px", paddingTop: "20px", borderTop: "1px solid var(--color-border)" }}>
            <button className="btn btn-secondary" disabled={currentIndex === 0} onClick={() => goToQuestion(currentIndex - 1)}>← Previous</button>
            <button className="btn btn-primary" disabled={currentIndex === questions.length - 1} onClick={() => goToQuestion(currentIndex + 1)}>Next →</button>
            <button className="btn btn-ghost" onClick={clearResponse}>Clear Response</button>
            <button className={`btn ${marked.has(currentQ.id) ? "btn-warning" : "btn-ghost"}`} onClick={toggleMark}>{marked.has(currentQ.id) ? "★ Marked" : "☆ Mark for Review"}</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-danger" onClick={() => setShowSubmitModal(true)}>Submit Test</button>
          </div>
        </div>

        {/* ─── Navigation Panel (right sidebar — always visible) ──── */}
        <aside className="question-nav-sidebar">
          <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "16px", color: "var(--color-text)" }}>Question Navigator</h3>

          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px", fontSize: "11px" }}>
            <span className="badge badge-primary">Current</span>
            <span className="badge badge-success">Answered</span>
            <span className="badge badge-warning">Marked</span>
            <span className="badge badge-danger">Unanswered</span>
            <span className="badge badge-neutral">Not Visited</span>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "16px" }}>
            <div style={{ textAlign: "center", padding: "10px 6px", borderRadius: "10px", background: "var(--color-success-light)", fontSize: "11px" }}>
              <strong style={{ fontSize: "18px", display: "block", color: "#065F46" }}>{answeredCount}</strong>
              Answered
            </div>
            <div style={{ textAlign: "center", padding: "10px 6px", borderRadius: "10px", background: "var(--color-warning-light)", fontSize: "11px" }}>
              <strong style={{ fontSize: "18px", display: "block", color: "#92400E" }}>{markedCount}</strong>
              Marked
            </div>
            <div style={{ textAlign: "center", padding: "10px 6px", borderRadius: "10px", background: "var(--color-section)", fontSize: "11px" }}>
              <strong style={{ fontSize: "18px", display: "block" }}>{skippedCount}</strong>
              Skipped
            </div>
          </div>

          <div className="nav-panel">
            {questions.map((q, i) => (
              <button key={q.id} className={`nav-btn ${getQuestionStatus(q, i)}`} onClick={() => goToQuestion(i)} title={`Q${i + 1}: ${q.subject}`}>
                {i + 1}
              </button>
            ))}
          </div>
        </aside>
      </div>

      {/* ─── Submit Confirmation Modal ──────────────────────────────────── */}
      {showSubmitModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowSubmitModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>Submit Test?</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--color-success)" }}>{answeredCount}</div>
                <div className="stat-label">Answered</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--color-warning)" }}>{markedCount}</div>
                <div className="stat-label">Marked</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: "var(--color-text-secondary)" }}>{skippedCount}</div>
                <div className="stat-label">Unanswered</div>
              </div>
            </div>

            {skippedCount > 0 && (
              <p style={{ fontSize: "13px", color: "var(--color-danger)", marginBottom: "16px", padding: "10px 14px", background: "var(--color-danger-light)", borderRadius: "10px" }}>
                ⚠️ You have <strong>{skippedCount}</strong> unanswered question{skippedCount > 1 ? "s" : ""}. Unanswered = 0 marks.
              </p>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowSubmitModal(false)} disabled={submitting}>Go Back</button>
              <button className="btn btn-danger" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Confirm Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
