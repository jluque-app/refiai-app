import { logFeedback } from "@/lib/tutor/log";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { refId, rating, comment } = await req.json();
    if (!refId || (rating !== "up" && rating !== "down")) {
      return new Response(JSON.stringify({ ok: false, error: "bad request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    await logFeedback({ refId, rating, comment });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
