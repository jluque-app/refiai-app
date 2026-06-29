"use client";

import { useState } from "react";
import { Lock, BarChart3, MessageSquare, ThumbsUp, ThumbsDown, BookOpen, Loader2, Check } from "lucide-react";

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
interface LogsResponse {
  ok: boolean;
  totals: { questions: number; ratedUp: number; ratedDown: number };
  byUnit: Record<string, number>;
  byDay: Record<string, number>;
  items: QAItem[];
}

export default function AdminDashboard() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<LogsResponse | null>(null);
  const [promoting, setPromoting] = useState<QAItem | null>(null);
  const [promoteText, setPromoteText] = useState({ q: "", a: "" });
  const [promoted, setPromoted] = useState<Record<string, boolean>>({});

  const load = async (k: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/logs", { headers: { "x-admin-key": k } });
      if (res.status === 401) {
        setError("Wrong password.");
        setLoading(false);
        return;
      }
      const json = (await res.json()) as LogsResponse;
      setData(json);
      setAuthed(true);
    } catch {
      setError("Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const promote = async () => {
    if (!promoting) return;
    try {
      const res = await fetch("/api/admin/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({ q: promoteText.q, a: promoteText.a }),
      });
      if (res.ok) {
        setPromoted((p) => ({ ...p, [promoting.id]: true }));
        setPromoting(null);
      } else {
        alert("Could not save (the host filesystem may be read-only in production).");
      }
    } catch {
      alert("Could not save.");
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-white dark:bg-slate-900 p-8 shadow-lg">
          <div className="flex flex-col items-center text-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/40">
              <Lock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold">ReFiAI · Teacher Dashboard</h1>
            <p className="text-sm text-slate-500">Enter the admin password to continue.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(key);
            }}
            className="space-y-3"
          >
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Admin password"
              className="w-full rounded-lg border px-3 py-2 bg-transparent text-center"
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !key}
              className="w-full rounded-lg bg-indigo-600 text-white py-2 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Unlock"}
            </button>
          </form>
          <p className="text-[11px] text-slate-400 text-center mt-4">
            Default dev password is <code>refiai-admin</code>. Set <code>ADMIN_PASSWORD</code> in
            .env.local to change it.
          </p>
        </div>
      </div>
    );
  }

  const totals = data?.totals || { questions: 0, ratedUp: 0, ratedDown: 0 };
  const satisfaction =
    totals.ratedUp + totals.ratedDown > 0
      ? Math.round((totals.ratedUp / (totals.ratedUp + totals.ratedDown)) * 100)
      : null;
  const unitEntries = Object.entries(data?.byUnit || {}).sort((a, b) => b[1] - a[1]);
  const maxUnit = unitEntries.length ? Math.max(...unitEntries.map(([, n]) => n)) : 1;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Teacher Dashboard</h1>
            <p className="text-sm text-slate-500">AI Tutor usage &amp; student questions</p>
          </div>
          <button
            onClick={() => load(key)}
            className="text-sm rounded-lg border px-3 py-2 hover:bg-white dark:hover:bg-slate-900"
          >
            ↻ Refresh
          </button>
        </header>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon={<MessageSquare className="w-4 h-4" />} label="Questions asked" value={totals.questions} />
          <Stat icon={<ThumbsUp className="w-4 h-4" />} label="Helpful 👍" value={totals.ratedUp} />
          <Stat icon={<ThumbsDown className="w-4 h-4" />} label="Not helpful 👎" value={totals.ratedDown} />
          <Stat icon={<BarChart3 className="w-4 h-4" />} label="Satisfaction" value={satisfaction === null ? "—" : `${satisfaction}%`} />
        </div>

        {/* By unit */}
        <section className="rounded-2xl border bg-white dark:bg-slate-900 p-5">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" /> Questions by unit
          </h2>
          {unitEntries.length === 0 ? (
            <p className="text-sm text-slate-500">No questions yet.</p>
          ) : (
            <div className="space-y-2">
              {unitEntries.map(([unit, n]) => (
                <div key={unit} className="flex items-center gap-3">
                  <div className="w-48 text-sm text-slate-600 dark:text-slate-300 truncate">{unit}</div>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded h-5 overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${(n / maxUnit) * 100}%` }} />
                  </div>
                  <div className="w-8 text-right text-sm font-mono">{n}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Question inbox */}
        <section className="rounded-2xl border bg-white dark:bg-slate-900 p-5">
          <h2 className="font-bold mb-1 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-500" /> Question inbox
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Review what students ask. Edit and <b>“Save to tutor”</b> to promote a vetted answer into
            the tutor&apos;s knowledge base — it starts using it immediately.
          </p>

          {(!data || data.items.length === 0) && (
            <div className="text-sm text-slate-500 border border-dashed rounded-xl p-6 text-center">
              No tutor conversations logged yet. Once the tutor has an API key and students start
              asking questions, they&apos;ll appear here.
            </div>
          )}

          <div className="space-y-4">
            {data?.items.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>
                    {item.unitTitle ? `${item.unitTitle}${item.lessonTitle ? " › " + item.lessonTitle : ""}` : "—"}
                  </span>
                  <span className="flex items-center gap-2">
                    {item.rating === "up" && <ThumbsUp className="w-3 h-3 text-green-500" />}
                    {item.rating === "down" && <ThumbsDown className="w-3 h-3 text-red-500" />}
                    {new Date(item.ts).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm font-semibold mb-1">Q: {item.question}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap mb-3">{item.answer}</div>

                {promoted[item.id] ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <Check className="w-3 h-3" /> Saved to tutor knowledge base
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setPromoting(item);
                      setPromoteText({ q: item.question || "", a: item.answer || "" });
                    }}
                    className="text-xs rounded-lg border px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Edit &amp; save to tutor →
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Promote modal */}
      {promoting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setPromoting(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-1">Save a vetted answer to the tutor</h3>
            <p className="text-xs text-slate-500 mb-4">
              Edit so it reads as the canonical answer. The tutor will retrieve and prefer this phrasing.
            </p>
            <label className="text-xs font-semibold">Question</label>
            <textarea
              value={promoteText.q}
              onChange={(e) => setPromoteText((p) => ({ ...p, q: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 bg-transparent text-sm mb-3 mt-1"
              rows={2}
            />
            <label className="text-xs font-semibold">Approved answer</label>
            <textarea
              value={promoteText.a}
              onChange={(e) => setPromoteText((p) => ({ ...p, a: e.target.value }))}
              className="w-full rounded-lg border px-3 py-2 bg-transparent text-sm mb-4 mt-1"
              rows={5}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setPromoting(null)} className="text-sm rounded-lg border px-4 py-2">
                Cancel
              </button>
              <button
                onClick={promote}
                disabled={!promoteText.q || !promoteText.a}
                className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 font-medium disabled:opacity-50"
              >
                Save to tutor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
        {icon} {label}
      </div>
      <div className="text-2xl font-extrabold">{value}</div>
    </div>
  );
}
