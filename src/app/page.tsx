"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { MockSet, Attempt } from "@/lib/types";
import { fetchSets, fetchAttempts } from "@/lib/api";
import { getDailyCookie, getSecondsUntilReset, formatTime } from "@/lib/cookies";

const TOTAL_SETS = 2;

type SetCardState = "available" | "in_progress" | "completed" | "not_ready";

interface SetInfo {
  set: MockSet | null;
  state: SetCardState;
  attempt?: Attempt;
}

export default function HomePage() {
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetSeconds, setResetSeconds] = useState<number | null>(null);
  const [daily, setDaily] = useState<ReturnType<typeof getDailyCookie> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [setsData, attemptsData] = await Promise.all([
        fetchSets().catch(() => []),
        fetchAttempts().catch(() => []),
      ]);

      const setInfos: SetInfo[] = [];
      for (let n = 1; n <= TOTAL_SETS; n++) {
        const set = setsData.find((s) => s.set_number === n) || null;
        const todayAttempt = attemptsData.find(
          (a) => a.set_number === n && a.attempt_date === new Date().toISOString().split("T")[0]
        );

        let state: SetCardState = "not_ready";
        if (set) {
          if (todayAttempt?.status === "completed") state = "completed";
          else if (todayAttempt?.status === "in_progress") state = "in_progress";
          else state = "available";
        }

        setInfos.push({ set, state, attempt: todayAttempt });
      }

      setSets(setInfos);
    } catch {
      setSets(Array.from({ length: TOTAL_SETS }, () => ({ set: null, state: "not_ready" as SetCardState })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setResetSeconds(getSecondsUntilReset());
    setDaily(getDailyCookie());
    const interval = setInterval(() => setResetSeconds(getSecondsUntilReset()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Reset Banner */}
      <div className="reset-banner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <span>Next paper refresh in</span>
        <span className="reset-banner-countdown">{resetSeconds !== null ? formatTime(resetSeconds) : "--:--:--"}</span>
      </div>

      {/* Hero */}
      <header style={{ textAlign: "center", padding: "72px 24px 48px" }}>
        <h1 className="hero-gradient-text" style={{ fontSize: "clamp(40px, 6vw, 60px)", marginBottom: "16px", fontWeight: 800 }}>
          GATEForge
        </h1>
        <p style={{ fontSize: "17px", color: "var(--color-text-secondary)", maxWidth: "520px", margin: "0 auto", lineHeight: "1.7", fontWeight: 400 }}>
          AI-powered GATE CS mock tests — 65 questions, 100 marks, 3 hours.
          <br />Fresh papers generated daily at 5:00 AM IST.
        </p>

        {daily?.status === "completed" && daily.score !== undefined && (
          <div style={{ marginTop: "28px", display: "inline-flex", alignItems: "center", gap: "10px", padding: "12px 28px", borderRadius: "14px", background: "var(--color-success-light)", border: "1px solid var(--color-success)" }}>
            <span style={{ fontSize: "14px", color: "#065F46", fontWeight: 600 }}>
              Today&apos;s Score: <strong style={{ fontSize: "22px" }}>{daily.score}</strong> / 100
            </span>
          </div>
        )}
      </header>

      {/* Set Cards */}
      <main style={{ maxWidth: "720px", margin: "0 auto", padding: "0 24px 80px" }}>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {Array.from({ length: TOTAL_SETS }).map((_, i) => (
              <div key={i} className="card" style={{ height: "240px" }}>
                <div className="skeleton" style={{ height: "20px", width: "60%", marginBottom: "12px" }} />
                <div className="skeleton" style={{ height: "14px", width: "80%", marginBottom: "8px" }} />
                <div className="skeleton" style={{ height: "14px", width: "40%", marginBottom: "24px" }} />
                <div className="skeleton" style={{ height: "44px", width: "100%" }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {sets.map((info, i) => (
              <SetCard key={i} index={i + 1} info={info} />
            ))}
          </div>
        )}

        {/* How it works */}
        <section style={{ marginTop: "72px", padding: "44px", borderRadius: "20px", background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <h2 style={{ fontSize: "20px", marginBottom: "28px", textAlign: "center", fontWeight: 700 }}>
            How GATEForge Works
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "28px" }}>
            <InfoStep number="1" title="Pick a Set" desc="Choose from 2 daily mock test papers." />
            <InfoStep number="2" title="Take the Test" desc="3 hours, 12 subjects, MCQ/MSQ/NAT." />
            <InfoStep number="3" title="Review Results" desc="Score, breakdown, and explanations." />
            <InfoStep number="4" title="Daily Refresh" desc="New papers every day at 5 AM IST." />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "32px 24px", borderTop: "1px solid var(--color-border)", color: "var(--color-text-tertiary)", fontSize: "13px" }}>
        <p style={{ marginBottom: "12px" }}>GATEForge — Built with AI. Not affiliated with IIT or GATE organising body.</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <span>Made by Sairuthwik</span>
          <a href="mailto:ruthwikchinnu22@gmail.com" title="Email Sairuthwik" style={{ display: "inline-flex", color: "var(--color-primary)", textDecoration: "none" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
}

function SetCard({ index, info }: { index: number; info: SetInfo }) {
  const { set, state, attempt } = info;
  const isLocked = state === "not_ready";

  const accentColor =
    state === "completed" ? "var(--color-success)" :
    state === "in_progress" ? "var(--color-warning)" :
    state === "available" ? "var(--color-primary)" :
    "var(--color-border)";

  return (
    <div className={`card${isLocked ? " card-locked" : ""}`} style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: accentColor }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "22px", fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.03em" }}>
              Set {index}
            </span>
            {state === "completed" && <span className="badge badge-success">✓ Done</span>}
            {state === "in_progress" && <span className="badge badge-warning">● Live</span>}
            {isLocked && <span className="badge badge-neutral">🔒 Locked</span>}
          </div>
          {set?.title && (
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>{set.title}</p>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
        <span>📋 {set?.total_questions || 65} Qs</span>
        <span>🎯 {set?.total_marks || 100} marks</span>
        <span>⏱ 3 hours</span>
      </div>

      {set?.generated_date && (
        <p style={{ fontSize: "12px", color: "var(--color-text-tertiary)", marginBottom: "16px" }}>
          Generated: {new Date(set.generated_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}

      {state === "available" && (
        <Link href={`/test/${index}`} className="btn btn-primary btn-lg" style={{ width: "100%", textDecoration: "none" }}>
          Start Test →
        </Link>
      )}
      {state === "in_progress" && (
        <Link href={`/test/${index}`} className="btn btn-warning btn-lg" style={{ width: "100%", textDecoration: "none" }}>
          Resume Test →
        </Link>
      )}
      {state === "completed" && attempt && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderRadius: "12px", background: "var(--color-success-light)" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#065F46" }}>Score</span>
            <span style={{ fontSize: "24px", fontWeight: 800, color: "#065F46" }}>{attempt.score} / 100</span>
          </div>
          <Link href={`/results/${attempt.id}`} className="btn btn-secondary" style={{ width: "100%", textDecoration: "none" }}>
            View Results
          </Link>
        </div>
      )}
      {isLocked && (
        <div className="btn btn-secondary" style={{ width: "100%", opacity: 0.6, cursor: "default" }}>
          Coming Soon
        </div>
      )}
    </div>
  );
}

function InfoStep({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: "40px", height: "40px", borderRadius: "12px", background: "var(--color-primary-light)",
        color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: "16px", margin: "0 auto 12px"
      }}>
        {number}
      </div>
      <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "6px" }}>{title}</h3>
      <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: "1.5" }}>{desc}</p>
    </div>
  );
}
