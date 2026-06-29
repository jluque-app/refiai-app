/**
 * Tutor knowledge base — grounds the AI Tutor in Jaime's own course content.
 *
 * This is deliberately dependency-free retrieval (keyword/overlap scoring over
 * the course material), so it ships today with no vector DB. The interface is
 * designed so a real embeddings store (pgvector / Pinecone / etc.) can be
 * dropped in later behind `retrieve()` without touching the route or the UI.
 */

import courseDataRaw from "@/content/course.json";
import faqRaw from "@/content/tutor-faq.json";
import type { CourseData } from "@/types/course";

const course = courseDataRaw as CourseData;

export interface KnowledgeChunk {
  partId: string;
  partTitle: string;
  unitId: string;
  unitTitle: string;
  lessonId: string;
  lessonTitle: string;
  text: string;
}

export interface FaqEntry {
  q: string;
  a: string;
  unitId?: string;
  tags?: string[];
}

const faq = faqRaw as FaqEntry[];

/** Flatten the whole course into retrievable text chunks (built once). */
function buildChunks(): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  for (const part of course.parts) {
    for (const unit of part.units) {
      for (const lesson of unit.lessons) {
        const base = {
          partId: part.id,
          partTitle: part.title,
          unitId: unit.id,
          unitTitle: unit.title,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
        };
        for (const section of lesson.sections ?? []) {
          if (section.type === "markdown" && section.content) {
            chunks.push({ ...base, text: section.content });
          }
          if (section.type === "quiz" && section.quizData) {
            // Quiz Q&A is gold for grounding — include the explanations.
            const qText = section.quizData
              .map(
                (q) =>
                  `Q: ${q.text}\nA: ${q.correctAnswer}${
                    q.explanation ? `\nWhy: ${q.explanation}` : ""
                  }`
              )
              .join("\n\n");
            chunks.push({ ...base, text: qText });
          }
        }
      }
    }
  }
  return chunks;
}

const CHUNKS = buildChunks();

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "are", "for", "on",
  "with", "as", "by", "at", "it", "this", "that", "what", "how", "why", "do",
  "does", "i", "you", "we", "be", "can", "if", "from", "my", "me",
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-zà-ÿ0-9]+/g) ?? []).filter(
    (t) => t.length > 2 && !STOPWORDS.has(t)
  );
}

function score(queryTokens: string[], text: string): number {
  const t = text.toLowerCase();
  let s = 0;
  for (const q of queryTokens) {
    // count occurrences, with diminishing returns
    const matches = t.split(q).length - 1;
    if (matches > 0) s += 1 + Math.log(matches);
  }
  return s;
}

/** Look up a single lesson's full content + its position in the course. */
export function getLessonContext(lessonId?: string): {
  partTitle?: string;
  unitTitle?: string;
  lessonTitle?: string;
  text: string;
} {
  if (!lessonId) return { text: "" };
  const lessonChunks = CHUNKS.filter((c) => c.lessonId === lessonId);
  if (lessonChunks.length === 0) return { text: "" };
  const first = lessonChunks[0];
  return {
    partTitle: first.partTitle,
    unitTitle: first.unitTitle,
    lessonTitle: first.lessonTitle,
    text: lessonChunks.map((c) => c.text).join("\n\n"),
  };
}

/**
 * Retrieve the most relevant grounding for a question.
 * Always prioritises the current lesson, then pulls the best-matching chunks
 * from anywhere in the course, plus any matching curated FAQ entries.
 */
export function retrieve(
  query: string,
  lessonId?: string,
  maxChunks = 4
): { context: string; faqHits: FaqEntry[]; sources: string[] } {
  const qTokens = tokenize(query);

  const ranked = CHUNKS.map((c) => {
    let s = score(qTokens, c.text);
    if (c.lessonId === lessonId) s += 3; // strong boost for the current lesson
    return { c, s };
  })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, maxChunks);

  // Ensure the current lesson is represented even if keyword score was low.
  const hasCurrent = ranked.some((r) => r.c.lessonId === lessonId);
  if (!hasCurrent && lessonId) {
    const cur = CHUNKS.filter((c) => c.lessonId === lessonId)[0];
    if (cur) ranked.unshift({ c: cur, s: 1 });
  }

  const faqHits = faq
    .map((f) => ({ f, s: score(qTokens, `${f.q} ${f.a} ${(f.tags ?? []).join(" ")}`) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
    .map((r) => r.f);

  const sources = Array.from(
    new Set(ranked.map((r) => `${r.c.unitTitle} › ${r.c.lessonTitle}`))
  );

  const context = ranked
    .map((r) => `### ${r.c.unitTitle} › ${r.c.lessonTitle}\n${r.c.text}`)
    .join("\n\n");

  return { context, faqHits, sources };
}
