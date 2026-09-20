"use client";

import Link from "next/link";
import { CalendarClock, Sparkles } from "lucide-react";
import AiTeacher from "@/components/ai/AiTeacher";
import { PREVIEW_MODE } from "@/lib/flags";

export default function ExpertChat() {
    return (
        <div className="container mx-auto px-4 py-10 max-w-3xl">
            <header className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Sparkles size={24} className="text-[hsl(var(--primary))]" /> Expert chat
                </h1>
                <p className="text-[hsl(var(--muted-foreground))] mt-2 text-sm">
                    Ask the AI tutor anything about the course — it&apos;s grounded in the actual lessons,
                    labs and problem sets. For feedback on your own models or career advice, the
                    professor&apos;s <Link href="/office-hours" className="text-[hsl(var(--primary))] underline underline-offset-2">live office hours</Link> are
                    the next step.
                </p>
            </header>

            <AiTeacher inline />

            <div className="mt-6 flex items-center gap-3 p-4 bg-[hsl(var(--secondary))] rounded-xl text-sm">
                <CalendarClock size={18} className="text-[hsl(var(--primary))] shrink-0" />
                <span>
                    {PREVIEW_MODE
                        ? "Prefer to talk it through live? Office hours with the professor open at launch. "
                        : "Prefer to talk it through live? Small-group sessions from €30 / 30 min. "}
                    <Link href="/office-hours" className="font-medium text-[hsl(var(--primary))] underline underline-offset-2">
                        {PREVIEW_MODE ? "Learn more" : "Book office hours"}
                    </Link>
                </span>
            </div>
        </div>
    );
}
