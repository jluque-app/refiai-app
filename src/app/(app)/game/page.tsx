"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Lock, MapPin, Gamepad2, GraduationCap, HardHat, Sparkles, Clock, Trophy } from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { EPISODES } from "@/lib/game/game-engine";
import { PREVIEW_MODE as PREVIEW } from "@/lib/flags";

/** Free tier — no account, no payment, always open. The on-ramp for Real Estate 101. */
const FREE = "E0_VALENCIA";
const ORDER = ["E1_VALENCIA", "E2_MADRID", "E3_BARCELONA", "E4_MIAMI", "E5_NYC", "E6_LONDON"];
/** Season 2 — unlocked by finishing Season 1 (E6). In preview mode every episode is open. */
const SEASON2 = ["E7_PARIS"];

const FLAGS: Record<string, string> = {
    E0_VALENCIA: "🇪🇸", E1_VALENCIA: "🇪🇸", E2_MADRID: "🇪🇸", E3_BARCELONA: "🇪🇸",
    E4_MIAMI: "🇺🇸", E5_NYC: "🇺🇸", E6_LONDON: "🇬🇧", E7_PARIS: "🇫🇷",
};

type Progress = Record<string, { stars: number; completed: boolean }>;

export default function GameHome() {
    const [progress, setProgress] = useState<Progress>({});

    useEffect(() => {
        try {
            setProgress(JSON.parse(localStorage.getItem("refiai_game_progress") || "{}"));
        } catch { /* ignore */ }
    }, []);

    const isUnlockedEp = (idx: number) => {
        if (PREVIEW) return true;
        // Episode 1 opens once the free episode is finished; after that it is sequential.
        if (idx === 0) return Boolean(progress[FREE]?.completed);
        return Boolean(progress[ORDER[idx - 1]]?.completed);
    };
    const season2Unlocked = PREVIEW || Boolean(progress[ORDER[ORDER.length - 1]]?.completed);

    return (
        <div className="container mx-auto px-4 py-10 max-w-5xl">
            <header className="mb-8 text-center">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center justify-center gap-3">
                    <Gamepad2 size={30} className="text-[hsl(var(--primary))]" /> ReFiAI Tycoon
                </h1>
                <p className="text-[hsl(var(--muted-foreground))] mt-3 max-w-2xl mx-auto">
                    Build a real estate empire across eight cities — with real market data, real
                    finance, and the same math you learn in the course. Each episode unlocks the
                    next. Earn up to three stars per city.
                </p>
                <Link href="/game/transcript"
                    className="inline-flex items-center gap-2 mt-4 text-sm px-4 py-2 rounded-full border hover:border-[hsl(var(--primary))] transition-colors">
                    <Trophy size={15} className="text-[hsl(var(--brand-gold))]" /> Your transcript
                </Link>
            </header>

            {/* ---- Free episode: the on-ramp. No account, no payment, open to everyone. ---- */}
            <FreeEpisodeCard ep={(EPISODES as any)[FREE]} progress={progress[FREE]} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {ORDER.map((id, idx) => {
                    const ep = (EPISODES as any)[id];
                    const unlocked = isUnlockedEp(idx);
                    const stars = progress[id]?.stars ?? 0;
                    return (
                        <div
                            key={id}
                            className={`relative rounded-2xl border p-6 bg-[hsl(var(--card))] transition-all ${unlocked ? "hover:shadow-lg hover:-translate-y-0.5" : "opacity-60"}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                        <MapPin size={14} /> Episode {idx + 1} · {ep.city} {FLAGS[id]}
                                    </div>
                                    <h2 className="text-xl font-bold mt-1">{ep.title}</h2>
                                </div>
                                <div className="flex gap-0.5" aria-label={`${stars} of 3 stars`}>
                                    {[1, 2, 3].map((s) => (
                                        <Star key={s} size={18}
                                            className={s <= stars ? "text-[hsl(var(--brand-gold))] fill-[hsl(var(--brand-gold))]" : "text-[hsl(var(--border))]"} />
                                    ))}
                                </div>
                            </div>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-3">{ep.topics}</p>
                            <div className="flex items-center justify-between mt-4">
                                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
                                    <GraduationCap size={13} /> {ep.syllabusDays}
                                </span>
                                {unlocked ? (
                                    <Link href={`/game/${id}`} className="btn btn-primary text-sm px-5 py-2 rounded-full">
                                        {progress[id]?.completed ? "Replay" : stars > 0 ? "Continue" : "Play"}
                                    </Link>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                                        <Lock size={14} /> Finish Episode {idx} to unlock
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Season 2 — Paris: development finance */}
                {SEASON2.map((id) => {
                    const ep = (EPISODES as any)[id];
                    const stars = progress[id]?.stars ?? 0;
                    return (
                        <div key={id} className={`relative rounded-2xl border-2 border-[hsl(var(--brand-gold))] p-6 bg-[hsl(var(--card))] transition-all ${season2Unlocked ? "hover:shadow-lg hover:-translate-y-0.5" : "opacity-60"}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                        <HardHat size={14} /> Season 2 · Episode 7 · {ep.city} {FLAGS[id]}
                                    </div>
                                    <h2 className="text-xl font-bold mt-1">{ep.title}</h2>
                                </div>
                                <div className="flex gap-0.5" aria-label={`${stars} of 3 stars`}>
                                    {[1, 2, 3].map((s) => (
                                        <Star key={s} size={18}
                                            className={s <= stars ? "text-[hsl(var(--brand-gold))] fill-[hsl(var(--brand-gold))]" : "text-[hsl(var(--border))]"} />
                                    ))}
                                </div>
                            </div>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-3">{ep.topics}</p>
                            <div className="flex items-center justify-between mt-4">
                                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
                                    <GraduationCap size={13} /> {ep.syllabusDays}
                                </span>
                                {season2Unlocked ? (
                                    <Link href={`/game/${id}`} className="btn btn-primary text-sm px-5 py-2 rounded-full">
                                        {progress[id]?.completed ? "Replay" : stars > 0 ? "Continue" : "Play"}
                                    </Link>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                                        <Lock size={14} /> Finish Season 1 to unlock
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="text-xs text-[hsl(var(--muted-foreground))] text-center mt-8">
                Spanish city data: live market data — Source: Fragua by Atlas Real Estate
                Analytics. Other cities (incl. Paris rents, yields and construction costs):
                instructor benchmark estimates. Progress is saved in this browser.
            </p>
        </div>
    );
}

/**
 * The free episode gets its own full-width card above the campaign: it is the first thing a
 * stranger sees, it has to say "free" and "25 minutes" before it says anything else, and it
 * must never show a lock.
 */
function FreeEpisodeCard({ ep, progress }: { ep: any; progress?: { stars: number; completed: boolean } }) {
    if (!ep) return null;
    const stars = progress?.stars ?? 0;
    return (
        <div className="relative rounded-2xl border-2 border-[hsl(var(--primary))] p-6 mb-6 bg-[hsl(var(--secondary))] transition-all hover:shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[hsl(var(--primary))] text-white">
                            <Sparkles size={12} /> FREE
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                            <Clock size={12} /> about 25 minutes
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                            <MapPin size={12} /> {ep.city} 🇪🇸
                        </span>
                    </div>
                    <h2 className="text-2xl font-bold mt-2">{ep.title}</h2>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2 max-w-xl">
                        Start here. Eight quarters, no debt, no jargon: buy a flat, work out what it
                        is actually worth, and learn the one habit that separates investors from
                        buyers. No account needed.
                    </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <div className="flex gap-0.5" aria-label={`${stars} of 3 stars`}>
                        {[1, 2, 3].map((s) => (
                            <Star key={s} size={18}
                                className={s <= stars ? "text-[hsl(var(--brand-gold))] fill-[hsl(var(--brand-gold))]" : "text-[hsl(var(--border))]"} />
                        ))}
                    </div>
                    <Link href={`/game/${ep.id}`} className="btn btn-primary text-sm px-6 py-2.5 rounded-full whitespace-nowrap">
                        {progress?.completed ? "Play again" : stars > 0 ? "Continue" : "Play free"}
                    </Link>
                </div>
            </div>
        </div>
    );
}
