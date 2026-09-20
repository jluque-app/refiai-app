"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Lock, MapPin, Gamepad2, GraduationCap } from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { EPISODES } from "@/lib/game/game-engine";

const ORDER = ["E1_VALENCIA", "E2_MADRID", "E3_BARCELONA", "E4_MIAMI", "E5_NYC", "E6_LONDON"];

const FLAGS: Record<string, string> = {
    E1_VALENCIA: "🇪🇸", E2_MADRID: "🇪🇸", E3_BARCELONA: "🇪🇸",
    E4_MIAMI: "🇺🇸", E5_NYC: "🇺🇸", E6_LONDON: "🇬🇧",
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
        if (idx === 0) return true;
        const prev = progress[ORDER[idx - 1]];
        return Boolean(prev?.completed);
    };

    return (
        <div className="container mx-auto px-4 py-10 max-w-5xl">
            <header className="mb-8 text-center">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center justify-center gap-3">
                    <Gamepad2 size={30} className="text-[hsl(var(--primary))]" /> ReFiAI Tycoon
                </h1>
                <p className="text-[hsl(var(--muted-foreground))] mt-3 max-w-2xl mx-auto">
                    Build a real estate empire across six cities — with real market data, real
                    finance, and the same math you learn in the course. Each episode unlocks the
                    next. Earn up to three stars per city.
                </p>
            </header>

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

                {/* Season 2 teaser */}
                <div className="rounded-2xl border border-dashed p-6 bg-[hsl(var(--muted)/0.3)] opacity-70">
                    <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                        <MapPin size={14} /> Season 2 · Paris 🇫🇷
                    </div>
                    <h2 className="text-xl font-bold mt-1">The Development Game</h2>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-3">
                        Ground-up development finance: land, the J-curve, front-door/back-door
                        feasibility. Coming after launch.
                    </p>
                </div>
            </div>

            <p className="text-xs text-[hsl(var(--muted-foreground))] text-center mt-8">
                Spanish city data: live market data — Source: Fragua by Atlas Real Estate
                Analytics. Other cities: instructor benchmark estimates. Progress is saved in
                this browser.
            </p>
        </div>
    );
}
