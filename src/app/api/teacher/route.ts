import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { getLessonContext, retrieve } from "@/lib/tutor/knowledge";
import { buildSystemPrompt } from "@/lib/tutor/prompt";
import { logQA } from "@/lib/tutor/log";

export const runtime = "nodejs";

// The in-app AI Tutor is powered by Claude (Anthropic). Configure the model
// via TUTOR_MODEL; default is a fast, low-cost Claude model.
const MODEL = process.env.TUTOR_MODEL || "claude-haiku-4-5-20251001";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface LessonCtx {
  partId?: string;
  unitId?: string;
  lessonId?: string;
}

export async function POST(req: Request) {
  let messages: ChatMessage[] = [];
  let context: LessonCtx = {};
  try {
    const body = await req.json();
    messages = Array.isArray(body.messages) ? body.messages : [];
    context = body.context || {};
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const question = lastUser?.content?.trim() || "";

  // --- Build grounding from Jaime's own content ---
  const lesson = getLessonContext(context.lessonId);
  const { context: retrieved, faqHits, sources } = retrieve(question, context.lessonId);

  const systemPrompt = buildSystemPrompt({
    ctx: {
      partTitle: lesson.partTitle,
      unitTitle: lesson.unitTitle,
      lessonTitle: lesson.lessonTitle,
    },
    lessonText: lesson.text,
    retrieved,
    faqHits,
  });

  const qaId = randomUUID();

  // --- Mock mode: no API key configured (works in local dev) ---
  if (!process.env.ANTHROPIC_API_KEY) {
    const where = lesson.lessonTitle
      ? ` You're on "${lesson.unitTitle} › ${lesson.lessonTitle}".`
      : "";
    const faqLine = faqHits[0] ? ` Here's a relevant note from the course: ${faqHits[0].a}` : "";
    const mock =
      `⚙️ Tutor is in preview mode (no ANTHROPIC_API_KEY set on the server).${where}` +
      ` Once the key is configured I'll answer from your course material.${faqLine}`;
    return new Response(mock, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "x-qa-id": qaId, "x-tutor-mock": "1" },
    });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const encoder = new TextEncoder();
  let answer = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const llmStream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of llmStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const delta = event.delta.text;
            if (delta) {
              answer += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }
        }
      } catch (err) {
        console.error("Tutor stream error:", err);
        if (!answer) {
          controller.enqueue(
            encoder.encode("The tutor is temporarily unavailable. Please try again.")
          );
        }
      } finally {
        controller.close();
        if (question && answer) {
          logQA({
            id: qaId,
            lessonId: context.lessonId,
            unitTitle: lesson.unitTitle,
            lessonTitle: lesson.lessonTitle,
            question,
            answer,
            model: MODEL,
            sources,
          }).catch(() => {});
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "x-qa-id": qaId,
    },
  });
}
