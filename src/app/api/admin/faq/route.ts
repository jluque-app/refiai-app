import { promises as fs } from "fs";
import path from "path";
import { isAdmin, unauthorized } from "@/lib/admin/auth";

export const runtime = "nodejs";

interface FaqEntry {
  q: string;
  a: string;
  unitId?: string;
  tags?: string[];
}

const FAQ_PATH = path.join(process.cwd(), "src", "content", "tutor-faq.json");

/** GET — list current curated FAQ entries. */
export async function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const raw = await fs.readFile(FAQ_PATH, "utf-8");
    return new Response(raw, { headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response("[]", { headers: { "Content-Type": "application/json" } });
  }
}

/**
 * POST — "promote" a vetted answer into the tutor's curated knowledge base.
 * The tutor immediately starts retrieving it. This is how the teacher trains it.
 * Note: on a read-only serverless FS this write no-ops; in production store the
 * curated FAQ in your database / CMS instead.
 */
export async function POST(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  let entry: FaqEntry;
  try {
    const body = await req.json();
    if (!body.q || !body.a) throw new Error("q and a required");
    entry = {
      q: String(body.q),
      a: String(body.a),
      unitId: body.unitId ? String(body.unitId) : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    };
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    let list: FaqEntry[] = [];
    try {
      list = JSON.parse(await fs.readFile(FAQ_PATH, "utf-8"));
    } catch {
      list = [];
    }
    list.push(entry);
    await fs.writeFile(FAQ_PATH, JSON.stringify(list, null, 2) + "\n", "utf-8");
    return new Response(JSON.stringify({ ok: true, count: list.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "write failed (read-only FS?)" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
