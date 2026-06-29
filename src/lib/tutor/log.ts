/**
 * Tutor Q&A logging — the data flywheel.
 *
 * Every exchange is recorded with its lesson context so that, over time, you
 * can (1) see exactly what students ask, (2) curate the best answers into
 * tutor-faq.json (which the tutor then retrieves), and (3) eventually export a
 * dataset for fine-tuning.
 *
 * Storage is pluggable. The default adapter appends JSONL to ./data on the
 * server filesystem — perfect for local dev. On a serverless host the FS is
 * usually read-only, so writes fail silently; swap `writeEntry` for a DB call
 * (Supabase/Postgres/Mongo) in production. Keep the same shape.
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface TutorLogEntry {
  id: string;
  ts: string; // ISO timestamp
  type: "qa" | "feedback";
  lessonId?: string;
  unitTitle?: string;
  lessonTitle?: string;
  question?: string;
  answer?: string;
  model?: string;
  sources?: string[];
  // feedback fields
  refId?: string; // id of the qa entry this feedback refers to
  rating?: "up" | "down";
  comment?: string;
}

const LOG_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(LOG_DIR, "tutor-logs.jsonl");

async function writeEntry(entry: TutorLogEntry): Promise<void> {
  // ---- Default adapter: append JSONL to ./data (dev) -------------------
  // ---- Production: replace this body with a DB insert. ------------------
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Read-only FS (serverless) or other error — never break the chat.
    // In production, send `entry` to your database here instead.
  }
}

export async function logQA(input: {
  id?: string;
  lessonId?: string;
  unitTitle?: string;
  lessonTitle?: string;
  question: string;
  answer: string;
  model: string;
  sources?: string[];
}): Promise<string> {
  const { id: providedId, ...rest } = input;
  const id = providedId ?? randomUUID();
  await writeEntry({
    id,
    ts: new Date().toISOString(),
    type: "qa",
    ...rest,
  });
  return id;
}

export async function logFeedback(input: {
  refId: string;
  rating: "up" | "down";
  comment?: string;
}): Promise<void> {
  await writeEntry({
    id: randomUUID(),
    ts: new Date().toISOString(),
    type: "feedback",
    ...input,
  });
}

/** Read all log entries (for the admin dashboard). Returns [] if none yet. */
export async function readEntries(): Promise<TutorLogEntry[]> {
  try {
    const raw = await fs.readFile(LOG_FILE, "utf-8");
    return raw
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => {
        try {
          return JSON.parse(l) as TutorLogEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is TutorLogEntry => e !== null);
  } catch {
    return [];
  }
}
