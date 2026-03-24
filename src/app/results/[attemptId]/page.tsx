"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { SubmitResponse, QuestionResult, SubjectBreakdown } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { sendChatMessage } from "@/lib/api";

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;

  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "skipped">("all");
  const [activeTab, setActiveTab] = useState<"overview" | "analyze">("overview");

  // ─── Global Chat Modal State ──────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState<QuestionResult | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Hello, how can I help you?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`gateforge_result_${attemptId}`);
    if (stored) setResult(JSON.parse(stored));
  }, [attemptId]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { if (chatOpen) scrollToBottom(); }, [chatMessages, chatOpen]);

  function openChat(question: QuestionResult) {
    setChatQuestion(question);
    setChatOpen(true);
    // Send initial context message
    const initialMsg = `I need help understanding this question:\n\n**Subject:** ${question.subject}\n**Question:** ${question.question_text}\n**My Answer:** ${question.userAnswer || "Skipped"}\n**Correct Answer:** ${question.correct_answer}\n\nCan you explain this concept to me?`;
    sendInitialChat(question, initialMsg);
  }

  async function sendInitialChat(question: QuestionResult, msg: string) {
    const newMsg = { role: "user" as const, content: msg };
    const history = [...chatMessages, newMsg];
    setChatMessages(history);
    setChatLoading(true);
    try {
      const { reply } = await sendChatMessage(question, history);
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : "Error connecting to AI";
      setChatMessages((prev) => [...prev, { role: "assistant", content: `❌ **Failed to connect**: ${errMessage}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleSendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const newMsg = { role: "user" as const, content: chatInput.trim() };
    const history = [...chatMessages, newMsg];
    setChatMessages(history);
    setChatInput("");
    setChatLoading(true);

    if (!chatQuestion) {
      setTimeout(() => {
        setChatMessages(prev => [...prev, { role: "assistant", content: "Please select 'Chat with AI Tutor' on a specific question in the Analyze tab so I know which question you need help with!" }]);
        setChatLoading(false);
      }, 500);
      return;
    }
    try {
      const { reply } = await sendChatMessage(chatQuestion, history);
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : "Error connecting to AI";
      setChatMessages((prev) => [...prev, { role: "assistant", content: `❌ **Failed**: ${errMessage}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  if (!result) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "48px", marginBottom: "16px" }}>📊</p>
          <h2 style={{ marginBottom: "8px" }}>No Results Found</h2>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "24px" }}>
            This result may have expired or the test wasn&apos;t submitted.
          </p>
          <Link href="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </div>
    );
  }

  const percentage = Math.round((result.score / result.totalMarks) * 100);
  const circumference = 2 * Math.PI * 72;
  const dashOffset = circumference - (circumference * percentage) / 100;
  const scoreColor = percentage >= 60 ? "var(--color-success)" : percentage >= 35 ? "var(--color-warning)" : "var(--color-danger)";

  const filteredQuestions = result.questionsWithAnswers.filter((q) => {
    if (filter === "correct") return q.isCorrect;
    if (filter === "wrong") return !q.isCorrect && !q.isSkipped;
    if (filter === "skipped") return q.isSkipped;
    return true;
  });

  const questionsToAnalyze = result.questionsWithAnswers.filter((q) => !q.isCorrect || q.isSkipped);
  const weakSubjects = result.subjectBreakdown.filter(s => s.marksScored < s.totalMarks * 0.5 && s.totalMarks > 0).sort((a,b) => (a.marksScored/a.totalMarks) - (b.marksScored/b.totalMarks)).slice(0, 3);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      {/* Header */}
      <header style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/" className="btn btn-ghost" style={{ textDecoration: "none" }}>← Home</Link>
          <h1 style={{ fontSize: "17px", fontWeight: 700 }}>Test Results</h1>
        </div>
      </header>

      {/* Tab Bar */}
      <div style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", padding: "0 24px", display: "flex" }}>
        <TabButton label="📊 Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
        <TabButton label={`🔍 Analyze${questionsToAnalyze.length > 0 ? ` (${questionsToAnalyze.length})` : ""}`} active={activeTab === "analyze"} onClick={() => setActiveTab("analyze")} />
      </div>

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <>
            {/* Score Hero */}
            <section style={{ textAlign: "center", marginBottom: "48px" }}>
              <div className="score-ring-container" style={{ margin: "0 auto 24px" }}>
                <svg width="180" height="180" viewBox="0 0 180 180">
                  <circle className="score-ring-bg" cx="90" cy="90" r="72" />
                  <circle className="score-ring-fill" cx="90" cy="90" r="72" style={{ stroke: scoreColor, strokeDasharray: circumference, strokeDashoffset: dashOffset }} />
                </svg>
                <div className="score-ring-text">
                  <span className="score-ring-value" style={{ color: scoreColor }}>{result.score}</span>
                  <span className="score-ring-label">out of {result.totalMarks}</span>
                </div>
              </div>
              <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
                {percentage >= 60 ? "🎉 Excellent performance!" : percentage >= 35 ? "👍 Good attempt! Keep practicing." : "📚 Keep pushing — practice makes perfect!"}
              </p>
            </section>

            {/* Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginBottom: "40px" }}>
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--color-text)" }}>{result.totalQuestions}</div><div className="stat-label">Total Qs</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--color-success)" }}>{result.correctCount}</div><div className="stat-label">Correct</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--color-danger)" }}>{result.wrongCount}</div><div className="stat-label">Wrong</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--color-text-secondary)" }}>{result.skippedCount}</div><div className="stat-label">Skipped</div></div>
              <div className="stat-card"><div className="stat-value" style={{ color: "var(--color-primary)" }}>{percentage}%</div><div className="stat-label">Accuracy</div></div>
            </div>

            {/* AI Performance Engine */}
            <section style={{ marginBottom: "40px", padding: "28px", background: "var(--color-surface)", borderRadius: "16px", border: "1px solid var(--color-border)", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <span style={{ fontSize: "28px" }}>🧠</span>
                <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0, color: "var(--color-foreground)" }}>AI Performance Insights</h2>
              </div>
              {weakSubjects.length > 0 ? (
                <div>
                  <p style={{ color: "var(--color-text-secondary)", marginBottom: "20px", fontSize: "15px", lineHeight: "1.6" }}>
                    Based on your recent exam profile, our AI suggests prioritizing the following engineering topics to maximize your GATE score trajectory. These areas showed the highest variance between attempted marks and accuracy.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                    {weakSubjects.map(ws => (
                      <div key={ws.subject} style={{ padding: "18px", border: "1px solid var(--color-danger)", background: "var(--color-danger-light)", borderRadius: "12px" }}>
                        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-danger)", marginBottom: "6px" }}>{ws.subject}</h3>
                        <p style={{ margin: 0, fontSize: "14px", color: "var(--color-danger)", fontWeight: 500 }}>
                          Scored {ws.marksScored} / {ws.totalMarks} ({Math.round(ws.marksScored/ws.totalMarks*100)}%)
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "16px", borderRadius: "12px", background: "var(--color-success-light)", border: "1px solid var(--color-success)" }}>
                  <p style={{ color: "var(--color-success)", fontWeight: 600, fontSize: "15px", margin: 0 }}>
                    Excellent work! No critical weak areas detected. Focus on maintaining consistency and speed across all subjects.
                  </p>
                </div>
              )}
            </section>

            {/* Performance Chart */}
            <section style={{ marginBottom: "48px", background: "var(--color-surface)", padding: "28px", borderRadius: "16px", border: "1px solid var(--color-border)", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "32px", color: "var(--color-foreground)" }}>Subject Mastery Visualization</h2>
              <div style={{ width: "100%", height: "380px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.subjectBreakdown} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="subject" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)', fontWeight: 500 }} interval={0} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)', fontWeight: 500 }} />
                    <Tooltip cursor={{ fill: 'var(--color-section)' }} contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', fontWeight: 600, fontSize: '14px' }} />
                    <Legend wrapperStyle={{ paddingTop: "20px", fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }} />
                    <Bar dataKey="totalMarks" name="Total Marks" fill="var(--color-text-tertiary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="marksScored" name="Your Score" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div style={{ textAlign: "center", marginTop: "48px" }}>
              <Link href="/" className="btn btn-primary btn-lg" style={{ textDecoration: "none" }}>← Back to Home</Link>
            </div>
          </>
        )}

        {/* ═══ ANALYZE TAB ═══ */}
        {activeTab === "analyze" && (
          <AnalyzeTab questionsToAnalyze={questionsToAnalyze} allQuestionsCount={result.questionsWithAnswers.length} onOpenChat={openChat} />
        )}
      </main>

      {/* ═══ FLOATING AI CHAT WIDGET ═══ */}
      {/* Chat Toggle Button */}
      <button 
        onClick={() => setChatOpen(!chatOpen)}
        style={{
          position: "fixed", bottom: "32px", right: "32px", width: "60px", height: "60px",
          borderRadius: "30px", background: "var(--color-primary)", color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)", border: "none", cursor: "pointer", zIndex: 1000,
          transition: "transform 0.2s", transform: chatOpen ? "scale(0.9)" : "scale(1)"
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {chatOpen ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </>
          ) : (
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          )}
        </svg>
      </button>

      {/* Floating Chat Container */}
      {chatOpen && (
        <div style={{
          position: "fixed", bottom: "100px", right: "32px", width: "360px", height: "500px",
          maxHeight: "calc(100vh - 140px)", background: "var(--color-surface)", borderRadius: "16px",
          boxShadow: "0 12px 32px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column",
          overflow: "hidden", zIndex: 1000, border: "1px solid var(--color-border)"
        }}>
          {/* Chat Header */}
          <div style={{ padding: "16px 20px", background: "var(--color-primary-light)", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: "15px", display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary)" }}>
                🤖 AI Tutor
              </span>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px", display: "block" }}>
                {chatQuestion ? `${chatQuestion.subject} · ${chatQuestion.topic || "General"}` : "Ask me anything!"}
              </span>
            </div>
            <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--color-primary)", padding: "4px 8px", borderRadius: "6px" }}>✕</button>
          </div>

          {/* Chat Messages */}
          <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", background: "var(--color-background)" }}>
            {chatMessages.map((msg, mIndex) => (
              <div key={mIndex} style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%", padding: "12px 16px", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: msg.role === "user" ? "var(--color-primary)" : "var(--color-surface)",
                color: msg.role === "user" ? "white" : "var(--color-text)",
                border: msg.role === "user" ? "none" : "1px solid var(--color-border)",
                fontSize: "14px", lineHeight: "1.6", boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
              }}>
                {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>}
              </div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: "flex-start", padding: "12px 16px", borderRadius: "14px", background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: "14px", color: "var(--color-text-secondary)" }}>
                <span style={{ animation: "pulse 1.5s infinite" }}>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div style={{ padding: "14px 20px", background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", flexShrink: 0 }}>
            <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} style={{ display: "flex", gap: "8px" }}>
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={chatQuestion ? "Ask a follow-up question..." : "Type your message..."} disabled={chatLoading} style={{ flex: 1, padding: "10px 16px", borderRadius: "20px", border: "1px solid var(--color-border)", fontSize: "14px", outline: "none", background: "var(--color-background)" }} />
              <button type="submit" disabled={chatLoading || !chatInput.trim()} className="btn btn-primary" style={{ padding: "0 18px", borderRadius: "20px" }}>Send</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Button ──────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "14px 20px", fontSize: "14px", fontWeight: active ? 700 : 500,
      color: active ? "var(--color-primary)" : "var(--color-text-secondary)",
      background: "none", border: "none",
      borderBottom: active ? "2.5px solid var(--color-primary)" : "2.5px solid transparent",
      cursor: "pointer", transition: "all 0.15s", marginBottom: "-1px",
    }}>
      {label}
    </button>
  );
}

// ─── Analyze Tab ─────────────────────────────────────────────────────────────

function AnalyzeTab({
  questionsToAnalyze, allQuestionsCount, onOpenChat,
}: {
  questionsToAnalyze: QuestionResult[];
  allQuestionsCount: number;
  onOpenChat: (q: QuestionResult) => void;
}) {
  if (questionsToAnalyze.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <p style={{ fontSize: "64px", marginBottom: "16px" }}>🏆</p>
        <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>Perfect Score!</h2>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "15px" }}>
          You answered all {allQuestionsCount} questions correctly. Nothing to analyze!
        </p>
      </div>
    );
  }

  const wrongCount = questionsToAnalyze.filter((q) => !q.isSkipped).length;
  const skippedCount = questionsToAnalyze.filter((q) => q.isSkipped).length;

  return (
    <div>
      <div style={{ textAlign: "center", padding: "32px 24px", background: "var(--color-surface)", borderRadius: "16px", border: "1px solid var(--color-border)", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>Areas for Improvement</h2>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: "24px", maxWidth: "480px", margin: "0 auto 24px" }}>
          Review explanations, references, and YouTube tutorials. Click &quot;Chat with AI Tutor&quot; if you need more help.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
          {wrongCount > 0 && (
            <div style={{ padding: "10px 20px", borderRadius: "12px", background: "var(--color-danger-light)", border: "1px solid var(--color-danger)" }}>
              <span style={{ fontWeight: 700, color: "var(--color-danger)", fontSize: "20px", display: "block" }}>{wrongCount}</span>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Wrong</span>
            </div>
          )}
          {skippedCount > 0 && (
            <div style={{ padding: "10px 20px", borderRadius: "12px", background: "var(--color-section)", border: "1px solid var(--color-border)" }}>
              <span style={{ fontWeight: 700, color: "var(--color-text-secondary)", fontSize: "20px", display: "block" }}>{skippedCount}</span>
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Skipped</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Question Analysis</h2>
          <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
            {questionsToAnalyze.length} question{questionsToAnalyze.length > 1 ? "s" : ""} to review
          </span>
        </div>

        {questionsToAnalyze.map((q, i) => (
          <AnalysisCard key={q.id} question={q} index={i + 1} onOpenChat={onOpenChat} />
        ))}
      </div>
    </div>
  );
}

// ─── Analysis Card ───────────────────────────────────────────────────────────

function AnalysisCard({ question, index, onOpenChat }: { question: QuestionResult; index: number; onOpenChat: (q: QuestionResult) => void }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ background: "var(--color-surface)", borderRadius: "16px", border: "1px solid var(--color-border)", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} style={{ width: "100%", padding: "16px 20px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", textAlign: "left" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", flex: 1 }}>
          <span style={{ width: "28px", height: "28px", minWidth: "28px", borderRadius: "8px", background: question?.isSkipped ? "var(--color-section)" : "var(--color-danger-light)", color: question?.isSkipped ? "var(--color-text-secondary)" : "var(--color-danger)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700 }}>
            {question?.isSkipped ? "–" : "✗"}
          </span>
          <div>
            <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--color-text)", display: "block", marginBottom: "2px" }}>
              Q{index} · {question?.subject || ""}
            </span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-primary)", background: "var(--color-primary-light)", padding: "2px 8px", borderRadius: "6px", display: "inline-block" }}>
              💡 {question?.topic || "Concept Analysis"}
            </span>
          </div>
        </div>
        <span style={{ fontSize: "18px", color: "var(--color-text-secondary)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: "16px", borderTop: "1px solid var(--color-border-subtle)" }}>
          {/* Question preview */}
          {question.needs_image && question.image_html ? (
            <div style={{ fontSize: "14px", color: "var(--color-text)", lineHeight: "1.6", background: "var(--color-section)", padding: "14px", borderRadius: "10px", marginTop: "16px" }} dangerouslySetInnerHTML={{ __html: question.image_html }} />
          ) : (
            <p style={{ fontSize: "14px", color: "var(--color-text)", lineHeight: "1.6", margin: 0, background: "var(--color-section)", padding: "14px", borderRadius: "10px", marginTop: "16px" }}>
              {question.question_text}
            </p>
          )}

          {/* Step-by-Step Solution */}
          <div style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--color-success-light)", border: "1px solid var(--color-success)" }}>
            <strong style={{ fontSize: "12px", color: "#065F46", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ✅ Step-by-Step Solution
            </strong>
            <div style={{ fontSize: "14px", lineHeight: "1.65", margin: 0, color: "var(--color-text)", whiteSpace: "pre-wrap" }}>
              <ReactMarkdown>{question.explanation || "No explanation provided."}</ReactMarkdown>
            </div>
          </div>

          {/* Key References */}
          {question.key_refs && question.key_refs.length > 0 && (
            <div style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--color-primary-light)", border: "1px solid var(--color-primary)" }}>
              <strong style={{ fontSize: "12px", color: "var(--color-primary)", display: "block", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                📚 Key References
              </strong>
              <ul style={{ margin: 0, padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {question.key_refs.map((ref, i) => (
                  <li key={i} style={{ fontSize: "14px", color: "var(--color-text)", lineHeight: "1.5" }}>{ref}</li>
                ))}
              </ul>
            </div>
          )}

          {/* YouTube Queries */}
          {question.youtube_queries && question.youtube_queries.length > 0 && (
            <div>
              <strong style={{ fontSize: "12px", color: "var(--color-text-secondary)", display: "block", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                🎬 Watch & Learn
              </strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {question.youtube_queries.map((query, i) => (
                  <a key={i} href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", background: "#ff000010", border: "1px solid #ff000030", color: "#cc0000", fontSize: "13px", fontWeight: 600, textDecoration: "none", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#ff000020"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ff000010"; }}>
                    <svg viewBox="0 0 24 24" fill="#cc0000" width="14" height="14"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/></svg>
                    {query}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Chat with AI Tutor button */}
          <button onClick={() => onOpenChat(question)} className="btn btn-outline" style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🤖</span> Chat with AI Tutor
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Question Review Card ─────────────────────────────────────────────────────

function QuestionReviewCard({ q, index, expanded, onToggle }: { q: QuestionResult; index: number; expanded: boolean; onToggle: () => void }) {
  const borderClass = q.isCorrect ? "review-correct" : q.isSkipped ? "review-skipped" : "review-wrong";

  return (
    <div className={`review-item ${borderClass}`}>
      <button onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, background: q.isCorrect ? "var(--color-success-light)" : q.isSkipped ? "var(--color-section)" : "var(--color-danger-light)", color: q.isCorrect ? "#065F46" : q.isSkipped ? "var(--color-text-secondary)" : "#991B1B" }}>
            {q.isCorrect ? "✓" : q.isSkipped ? "–" : "✗"}
          </span>
          <div>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)" }}>Q{index}</span>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginLeft: "8px" }}>
              {q.subject} · {q.question_type} · {q.marks}m
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: q.marksAwarded > 0 ? "var(--color-success)" : q.marksAwarded < 0 ? "var(--color-danger)" : "var(--color-text-secondary)" }}>
            {q.marksAwarded > 0 ? `+${q.marksAwarded}` : q.marksAwarded < 0 ? q.marksAwarded : "0"}
          </span>
          <span style={{ fontSize: "18px", color: "var(--color-text-secondary)", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
        </div>
      </button>

      {expanded && (
        <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--color-border-subtle)" }}>
          {q.needs_image && q.image_html ? (
            <div style={{ fontSize: "15px", lineHeight: "1.7", marginBottom: "16px" }} dangerouslySetInnerHTML={{ __html: q.image_html }} />
          ) : (
            <p style={{ fontSize: "15px", lineHeight: "1.7", marginBottom: "16px", whiteSpace: "pre-wrap" }}>{q.question_text}</p>
          )}

          {q.options && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
              {Object.entries(q.options).map(([key, value]) => {
                const isUserAns = q.userAnswer?.split(",").map(a => a.trim()).includes(key);
                const isCorrectAns = q.correct_answer.split(",").map(a => a.trim()).includes(key);
                let optBg = "transparent", optBorder = "var(--color-border)";
                let optLabelBg = "var(--color-section)", optLabelColor = "var(--color-text-secondary)";
                if (isCorrectAns) { optBg = "var(--color-success-light)"; optBorder = "var(--color-success)"; optLabelBg = "var(--color-success)"; optLabelColor = "white"; }
                else if (isUserAns && !isCorrectAns) { optBg = "var(--color-danger-light)"; optBorder = "var(--color-danger)"; optLabelBg = "var(--color-danger)"; optLabelColor = "white"; }
                return (
                  <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px", border: `2px solid ${optBorder}`, borderRadius: "10px", background: optBg, fontSize: "14px" }}>
                    <span style={{ width: "24px", height: "24px", minWidth: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, background: optLabelBg, color: optLabelColor }}>{key}</span>
                    <span>{value}</span>
                    {isCorrectAns && <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--color-success)", fontWeight: 600 }}>✓ Correct</span>}
                    {isUserAns && !isCorrectAns && <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--color-danger)", fontWeight: 600 }}>✗ Your answer</span>}
                  </div>
                );
              })}
            </div>
          )}

          {q.question_type === "NAT" && (
            <div style={{ display: "flex", gap: "16px", marginBottom: "16px", fontSize: "14px" }}>
              <div style={{ padding: "10px 16px", borderRadius: "10px", background: q.isCorrect ? "var(--color-success-light)" : "var(--color-danger-light)" }}>
                <span style={{ color: "var(--color-text-secondary)", fontSize: "12px" }}>Your Answer: </span>
                <strong>{q.userAnswer || "—"}</strong>
              </div>
              <div style={{ padding: "10px 16px", borderRadius: "10px", background: "var(--color-success-light)" }}>
                <span style={{ color: "var(--color-text-secondary)", fontSize: "12px" }}>Correct: </span>
                <strong>{q.correct_answer}</strong>
              </div>
            </div>
          )}

          {q.explanation && (
            <div style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--color-primary-light)", border: "1px solid var(--color-primary)", fontSize: "14px", lineHeight: "1.6" }}>
              <strong style={{ color: "var(--color-primary)", fontSize: "13px", display: "block", marginBottom: "6px" }}>💡 Explanation</strong>
              <span style={{ color: "var(--color-text)" }}>{q.explanation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
