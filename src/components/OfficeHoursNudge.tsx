"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, X } from "lucide-react";
import { OH_EVENT, OfficeHoursReason } from "@/lib/office-hours";

const COPY: Record<OfficeHoursReason, { title: string; body: string }> = {
    quiz: {
        title: "Stuck on this one?",
        body: "That's exactly what office hours are for. Book 30 minutes — small-group from €30 — and we'll work through it together.",
    },
    tutor: {
        title: "Want to talk this through live?",
        body: "Sometimes 30 minutes on a call beats an hour of chat. Small-group sessions from €30, one-to-one from €75.",
    },
    unit: {
        title: "Nice work finishing this unit.",
        body: "Want feedback on how you'd apply it? Join a small-group office hour with the professor — from €30 for 30 minutes.",
    },
};

export default function OfficeHoursNudge() {
    const [reason, setReason] = useState<OfficeHoursReason | null>(null);

    useEffect(() => {
        const onNudge = (e: Event) => {
            const r = (e as CustomEvent).detail?.reason as OfficeHoursReason | undefined;
            if (!r) return;
            try {
                sessionStorage.setItem("refiai_oh_shown", "1");
            } catch { /* ignore */ }
            setReason(r);
        };
        window.addEventListener(OH_EVENT, onNudge);
        return () => window.removeEventListener(OH_EVENT, onNudge);
    }, []);

    if (!reason) return null;
    const copy = COPY[reason];

    const dismiss = () => {
        try {
            localStorage.setItem(`refiai_oh_dismissed_${reason}`, "1");
        } catch { /* ignore */ }
        setReason(null);
    };

    return (
        <div className="fixed bottom-4 left-4 z-40 max-w-sm w-[calc(100%-2rem)] sm:w-96 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-xl p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
                        <CalendarClock size={18} />
                        <span className="font-semibold text-sm text-[hsl(var(--foreground))]">{copy.title}</span>
                    </div>
                    <button onClick={dismiss} aria-label="Dismiss" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] shrink-0">
                        <X size={16} />
                    </button>
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2 mb-4">{copy.body}</p>
                <div className="flex items-center gap-3">
                    <Link href="/office-hours" onClick={() => setReason(null)} className="btn btn-primary text-sm px-4 py-2 rounded-full">
                        See office hours
                    </Link>
                    <button onClick={dismiss} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                        Not now
                    </button>
                </div>
            </div>
        </div>
    );
}
