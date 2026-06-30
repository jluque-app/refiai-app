"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Check, Loader2, Sparkles } from "lucide-react";
import { useUser } from "@/components/UserContext";
import { CoursePart } from "@/types/course";

/**
 * Paywall — shown in place of a premium lesson the learner hasn't unlocked.
 * Buying is per-module (per course "part"). Calls /api/checkout: if Stripe is
 * configured it redirects to Checkout; until then it returns {mock:true} and we
 * grant access locally so the whole flow is demoable now.
 */
export default function Paywall({ part }: { part: CoursePart }) {
  const { unlockCourse, user } = useUser();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const unitCount = part.units.length;
  const lessonCount = part.units.reduce((n, u) => n + u.lessons.length, 0);

  const buy = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: part.priceId, courseId: part.id }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url; // real Stripe Checkout
        return;
      }
      // mock (Stripe not configured yet) — grant access locally
      unlockCourse(part.id);
      setDone(true);
    } catch {
      // graceful fallback for the demo
      unlockCourse(part.id);
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto my-10 rounded-2xl border bg-card p-8 text-center shadow-lg">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10">
        <Lock className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-2xl font-extrabold tracking-tight">{part.title}</h2>
      <p className="mt-2 text-muted-foreground">{part.description}</p>

      <div className="my-6 flex items-baseline justify-center gap-1">
        <span className="text-4xl font-extrabold">€{part.price}</span>
        <span className="text-muted-foreground">one-time</span>
      </div>

      <ul className="mx-auto mb-6 max-w-sm space-y-2 text-left text-sm">
        {[
          `${unitCount} units · ${lessonCount} lessons`,
          "Interactive labs + downloadable Excel models",
          "Worked problem sets with instant feedback",
          "Video walkthroughs and the AI Tutor",
          "Lifetime access",
        ].map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {done ? (
        <div className="rounded-lg bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
          ✓ Unlocked! Reloading the lesson…
        </div>
      ) : (
        <button
          onClick={buy}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Unlock {part.title}
        </button>
      )}

      {!user && (
        <p className="mt-4 text-xs text-muted-foreground">
          Have an account?{" "}
          <Link href="/login" className="underline hover:text-primary">
            Sign in
          </Link>{" "}
          to sync your purchases.
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">Secure checkout. 14-day refund.</p>
    </div>
  );
}
