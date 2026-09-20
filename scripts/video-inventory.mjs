/**
 * video-inventory.mjs — list every video embedded in the course, with the lesson it belongs to.
 *
 *   node scripts/video-inventory.mjs
 *
 * Writes a markdown table to
 *   ReFiAI_Build/05_launch/COURSE_VIDEO_INVENTORY.md   (if that folder is reachable)
 * and always prints it to the terminal.
 *
 * Why this exists: the 20 course videos are hosted on the ESCP Drive, which cannot share
 * outside the institution, and are currently shared with the owner only — so no student can
 * play any of them. Before launch each one is keep / re-record / cut. This is the worksheet.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const course = JSON.parse(readFileSync(resolve(here, "../src/content/course.json"), "utf8"));

const DRIVE = /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/g;
const OTHER = /(?:youtube\.com\/embed\/|youtu\.be\/|vimeo\.com\/)([A-Za-z0-9_-]+)/g;

const rows = [];
function walk(node, ctx = {}) {
    if (Array.isArray(node)) return node.forEach((x) => walk(x, ctx));
    if (!node || typeof node !== "object") return;

    const id = node.id ?? "";
    const title = node.title ?? "";
    const next = { ...ctx };
    if (id.startsWith("part-")) next.part = title;
    else if (id.startsWith("unit-")) next.unit = title;
    else if (id.startsWith("lesson-")) { next.lessonId = id; next.lessonTitle = title; }

    for (const [key, value] of Object.entries(node)) {
        if (typeof value === "string") {
            for (const re of [DRIVE, OTHER]) {
                re.lastIndex = 0;
                let m;
                while ((m = re.exec(value)) !== null) {
                    rows.push({
                        part: next.part ?? "?", unit: next.unit ?? "?",
                        lessonId: next.lessonId ?? "?", lessonTitle: next.lessonTitle ?? "?",
                        field: key, host: re === DRIVE ? "ESCP Drive" : "other", fileId: m[1],
                    });
                }
            }
        } else walk(value, next);
    }
}
walk(course);

// de-duplicate by file id, keeping the first lesson it appears in
const seen = new Set();
const unique = rows.filter((r) => (seen.has(r.fileId) ? false : seen.add(r.fileId)));

const md = [
    "# Course video inventory",
    "",
    `_Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/video-inventory.mjs\`._`,
    "",
    `**${unique.length} videos** embedded across the course.`,
    "Mark each one **keep** (re-host as is), **re-record** (your voice, new footage) or **cut**.",
    "",
    "| # | Part | Unit | Lesson | Host | File id | Decision |",
    "|---|---|---|---|---|---|---|",
    ...unique.map((r, i) =>
        `| ${i + 1} | ${r.part} | ${r.unit} | \`${r.lessonId}\` ${r.lessonTitle} | ${r.host} | \`${r.fileId}\` | |`),
    "",
    "## Notes",
    "",
    "- ESCP-Drive files cannot be shared outside the institution and are currently owner-only:",
    "  every one of them shows a sign-in wall to students. Re-host on allretech / Vimeo / a bucket.",
    "- Replace the id in `src/content/course.json` once the new file is public; the embed pattern",
    "  is `https://drive.google.com/file/d/<ID>/preview`.",
].join("\n");

console.log(md);

const out = resolve(here,
    "../../../../Apps/ReFiAI/ReFiAI_Build/05_launch/COURSE_VIDEO_INVENTORY.md");
try {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, md + "\n");
    console.log(`\nWritten to ${out}`);
} catch (e) {
    console.log(`\n(Could not write to ${out}: ${e.message} — copy the table above instead.)`);
}
