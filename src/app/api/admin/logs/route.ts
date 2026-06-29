import { readEntries, TutorLogEntry } from "@/lib/tutor/log";
import { isAdmin, unauthorized } from "@/lib/admin/auth";

export const runtime = "nodejs";

interface QAItem {
  id: string;
  ts: string;
  unitTitle?: string;
  lessonTitle?: string;
  question?: string;
  answer?: string;
  model?: string;
  rating?: "up" | "down";
}

export async function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized();

  const entries = await readEntries();

  // Join feedback onto its Q&A by refId.
  const feedbackByRef = new Map<string, "up" | "down">();
  for (const e of entries) {
    if (e.type === "feedback" && e.refId && e.rating) feedbackByRef.set(e.refId, e.rating);
  }

  const qa: QAItem[] = entries
    .filter((e: TutorLogEntry) => e.type === "qa")
    .map((e) => ({
      id: e.id,
      ts: e.ts,
      unitTitle: e.unitTitle,
      lessonTitle: e.lessonTitle,
      question: e.question,
      answer: e.answer,
      model: e.model,
      rating: feedbackByRef.get(e.id),
    }))
    .sort((a, b) => (a.ts < b.ts ? 1 : -1)); // newest first

  // Aggregates
  const byUnit: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  let up = 0;
  let down = 0;
  for (const q of qa) {
    const unit = q.unitTitle || "Unknown";
    byUnit[unit] = (byUnit[unit] || 0) + 1;
    const day = (q.ts || "").slice(0, 10);
    if (day) byDay[day] = (byDay[day] || 0) + 1;
    if (q.rating === "up") up++;
    if (q.rating === "down") down++;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      totals: { questions: qa.length, ratedUp: up, ratedDown: down },
      byUnit,
      byDay,
      items: qa,
      tutorKeySet: !!process.env.ANTHROPIC_API_KEY,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
