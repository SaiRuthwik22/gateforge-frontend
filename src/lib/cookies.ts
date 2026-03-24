// ─── Browser-Side Cookie Helpers ────────────────────────────────────────────

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export interface BrowserCookie {
  browserId: string;
  firstVisit: string;
}

export interface DailyCookie {
  date: string;
  setAttempted: number;
  status: "in_progress" | "completed";
  score?: number;
  startedAt?: string;
  completedAt?: string;
  timeTakenSeconds?: number;
}

export function getBrowserCookie(): BrowserCookie | null {
  try {
    const raw = getCookie("gateforge_browser");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getDailyCookie(): DailyCookie | null {
  try {
    const raw = getCookie("gateforge_daily");
    if (!raw) return null;
    const data: DailyCookie = JSON.parse(raw);
    // Validate it's from today (IST)
    const today = getISTDateString();
    if (data.date !== today) return null;
    return data;
  } catch {
    return null;
  }
}

function getISTDateString(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split("T")[0];
}

/**
 * Returns seconds until next daily reset (4:59 AM IST = 23:29 UTC)
 */
export function getSecondsUntilReset(): number {
  const now = new Date();
  const expiry = new Date();
  expiry.setUTCHours(23, 29, 0, 0);
  if (now.getTime() >= expiry.getTime()) {
    expiry.setUTCDate(expiry.getUTCDate() + 1);
  }
  return Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000));
}

/**
 * Format seconds into HH:MM:SS
 */
export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
