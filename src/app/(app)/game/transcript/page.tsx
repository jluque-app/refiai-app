"use client";

/**
 * The Tycoon transcript — the campaign wrapper.
 *
 * Reads what the player has actually done (progress + each episode's saved end-of-run report)
 * and turns it into one page they can keep or share: stars, return per episode, the habits the
 * engine tracked, and a headline that is earned rather than generic.
 *
 * Shareable without any dependency: the card is rendered as inline SVG, serialised to a blob
 * and rasterised through a canvas, so "Download as image" is a few lines rather than a library.
 */

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Star, Trophy, Share2, Check } from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { EPISODES } from "@/lib/game/game-engine";

const CAMPAIGN = ["E0_VALENCIA", "E1_VALENCIA", "E2_MADRID", "E3_BARCELONA", "E4_MIAMI", "E5_NYC", "E6_LONDON", "E7_PARIS"];
const FLAG: Record<string, string> = {
    E0_VALENCIA: "🇪🇸", E1_VALENCIA: "🇪🇸", E2_MADRID: "🇪🇸", E3_BARCELONA: "🇪🇸",
    E4_MIAMI: "🇺🇸", E5_NYC: "🇺🇸", E6_LONDON: "🇬🇧", E7_PARIS: "🇫🇷",
};

const eur = (v: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`);

type Row = {
    id: string; city: string; title: string; stars: number; played: boolean;
    irr: number | null; nav: number | null; note: string | null;
};

/** One line of colour per episode — the thing the engine noticed about how they played it. */
function noteFor(id: string, m: any): string | null {
    if (!m) return null;
    switch (id) {
        case "E0_VALENCIA":
        case "E1_VALENCIA":
            return m.negativeNPVBuys === 0 ? "Never overpaid" : `${m.negativeNPVBuys} deal${m.negativeNPVBuys > 1 ? "s" : ""} bought above value`;
        case "E2_MADRID":
            return m.covenantBreaches === 0 ? "Never touched a covenant" : `${m.covenantBreaches} quarter(s) under the covenant`;
        case "E3_BARCELONA":
            return m.promotePaid > 0 ? `Promote earned ${eur(m.promotePaid)}` : "No promote earned";
        case "E4_MIAMI":
            return `${m.patternsUsed ?? 0} of 4 repayment patterns used`;
        case "E5_NYC":
            return m.overparNoteBuys === 0 ? "Never paid above fair value for paper" : `${m.overparNoteBuys} note(s) bought rich`;
        case "E6_LONDON":
            return m.trancheImpairments === 0 ? "No tranche impaired" : `${m.trancheImpairments} tranche(s) impaired`;
        case "E7_PARIS":
            return m.projectsDelivered > 0
                ? `${m.projectsDelivered} project${m.projectsDelivered > 1 ? "s" : ""} delivered, avg margin ${pct(m.avgMarginOnCost)}`
                : "No project delivered";
        default: return null;
    }
}

/** An earned headline: the best true thing about this campaign. */
function headline(rows: Row[], totalStars: number, maxStars: number): string {
    const played = rows.filter((r) => r.played);
    if (!played.length) return "The campaign is still ahead of you.";
    if (totalStars === maxStars) return "A perfect campaign. Every star, every city.";
    const perfectDiscipline = played.every((r) => !/above value|bought rich/.test(r.note ?? ""));
    const best = played.reduce((a, b) => ((b.irr ?? -1) > (a.irr ?? -1) ? b : a));
    if (played.length === rows.length) return `All eight cities finished, ${totalStars} of ${maxStars} stars.`;
    if (perfectDiscipline && played.length >= 3) return "Three cities in and still no deal bought above its value.";
    if (best.irr != null && best.irr > 0.15) return `Best run so far: ${best.city} at ${pct(best.irr)}.`;
    return `${played.length} of ${rows.length} cities played, ${totalStars} of ${maxStars} stars.`;
}

export default function TranscriptPage() {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [copied, setCopied] = useState(false);
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const progress = (() => {
            try { return JSON.parse(localStorage.getItem("refiai_game_progress") || "{}"); } catch { return {}; }
        })();
        const out: Row[] = CAMPAIGN.map((id) => {
            const ep: any = (EPISODES as any)[id];
            let m: any = null, nav: number | null = null;
            try {
                const save = JSON.parse(localStorage.getItem(`refiai_game_save_${id}`) || "null");
                if (save?.lastReport) { m = save.lastReport.metrics; nav = save.lastReport.nav ?? null; }
            } catch { /* ignore */ }
            const p = progress[id];
            return {
                id, city: ep?.city ?? id, title: ep?.title ?? "",
                stars: p?.stars ?? 0, played: Boolean(p) || Boolean(m),
                irr: m?.portfolioIRR ?? null, nav, note: noteFor(id, m),
            };
        });
        setRows(out);
    }, []);

    const totalStars = useMemo(() => (rows ?? []).reduce((s, r) => s + r.stars, 0), [rows]);
    const maxStars = CAMPAIGN.length * 3;
    const playedCount = (rows ?? []).filter((r) => r.played).length;

    const download = () => {
        const svg = svgRef.current;
        if (!svg) return;
        const xml = new XMLSerializer().serializeToString(svg);
        const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
        const img = new Image();
        img.onload = () => {
            const scale = 2;
            const canvas = document.createElement("canvas");
            canvas.width = 900 * scale; canvas.height = 620 * scale;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0, 900, 620);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
                if (!blob) return;
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "refiai-tycoon-transcript.png";
                a.click();
                URL.revokeObjectURL(a.href);
            }, "image/png");
        };
        img.src = url;
    };

    const copySummary = async () => {
        if (!rows) return;
        const lines = [
            `ReFiAI Tycoon — my transcript`,
            `${totalStars}/${maxStars} stars across ${playedCount} of ${CAMPAIGN.length} cities`,
            ...rows.filter((r) => r.played).map((r) =>
                `${"★".repeat(r.stars)}${"☆".repeat(3 - r.stars)}  ${r.city} — ${r.title}${r.irr != null ? ` · IRR ${pct(r.irr)}` : ""}`),
            ``, `Real estate finance, played: refiai.allretech.org`,
        ];
        try { await navigator.clipboard.writeText(lines.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
    };

    if (!rows) return <div className="p-10 text-[hsl(var(--muted-foreground))]">Reading your campaign…</div>;

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Link href="/game" className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center gap-1.5 mb-5">
                <ArrowLeft size={15} /> Back to episodes
            </Link>

            <header className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Trophy size={28} className="text-[hsl(var(--brand-gold))]" /> Your Tycoon transcript
                </h1>
                <p className="text-[hsl(var(--muted-foreground))] mt-2">
                    {headline(rows, totalStars, maxStars)}
                </p>
            </header>

            {/* the shareable card */}
            <div className="rounded-2xl border overflow-hidden bg-[hsl(var(--card))] mb-5">
                <TranscriptCard ref={svgRef} rows={rows} totalStars={totalStars} maxStars={maxStars} />
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
                <button onClick={download} className="btn btn-primary text-sm px-5 py-2.5 rounded-full flex items-center gap-2">
                    <Download size={15} /> Download as image
                </button>
                <button onClick={copySummary} className="btn bg-[hsl(var(--card))] border text-sm px-5 py-2.5 rounded-full flex items-center gap-2">
                    {copied ? <><Check size={15} /> Copied</> : <><Share2 size={15} /> Copy as text</>}
                </button>
            </div>

            {/* the detail nobody shares but everybody reads */}
            <h2 className="font-semibold mb-3">Episode by episode</h2>
            <div className="space-y-2">
                {rows.map((r) => (
                    <div key={r.id} className={`border rounded-xl p-4 flex flex-wrap items-center gap-3 ${r.played ? "bg-[hsl(var(--card))]" : "opacity-60"}`}>
                        <div className="flex gap-0.5 shrink-0">
                            {[1, 2, 3].map((s) => (
                                <Star key={s} size={16}
                                    className={s <= r.stars ? "text-[hsl(var(--brand-gold))] fill-[hsl(var(--brand-gold))]" : "text-[hsl(var(--border))]"} />
                            ))}
                        </div>
                        <div className="flex-1 min-w-[12rem]">
                            <div className="font-medium">{r.city} {FLAG[r.id]} — {r.title}</div>
                            <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                {r.played ? (r.note ?? "Played") : "Not played yet"}
                            </div>
                        </div>
                        {r.played && (
                            <div className="text-right">
                                <div className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">IRR</div>
                                <div className="font-mono font-semibold">{pct(r.irr)}</div>
                            </div>
                        )}
                        {!r.played && (
                            <Link href={`/game/${r.id}`} className="text-sm px-4 py-2 rounded-full border">Play</Link>
                        )}
                    </div>
                ))}
            </div>

            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-6">
                Built from this browser's saved runs. Replaying an episode keeps your best star count.
            </p>
        </div>
    );
}

/* ------------------------------ the shareable SVG ------------------------------ */

const TranscriptCard = forwardRef<SVGSVGElement, { rows: Row[]; totalStars: number; maxStars: number }>(
    function TranscriptCard({ rows, totalStars, maxStars }, ref) {
        const W = 900, H = 620;
        const played = rows.filter((r) => r.played);
        return (
            <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" xmlns="http://www.w3.org/2000/svg"
                style={{ display: "block", background: "#0b1220" }}>
                <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#065f46" />
                        <stop offset="100%" stopColor="#0b1220" />
                    </linearGradient>
                </defs>
                <rect width={W} height={H} fill="url(#g)" />
                <text x="48" y="74" fill="#ffffff" fontFamily="Georgia, serif" fontSize="34" fontWeight="bold">
                    ReFiAI Tycoon
                </text>
                <text x="48" y="106" fill="#a7f3d0" fontFamily="Helvetica, Arial, sans-serif" fontSize="17">
                    Campaign transcript · real estate finance, played
                </text>

                <text x={W - 48} y="82" fill="#fbbf24" fontFamily="Helvetica, Arial, sans-serif" fontSize="40"
                    fontWeight="bold" textAnchor="end">{totalStars}<tspan fontSize="20" fill="#d1d5db">/{maxStars}</tspan></text>
                <text x={W - 48} y="106" fill="#d1d5db" fontFamily="Helvetica, Arial, sans-serif" fontSize="14"
                    textAnchor="end">stars earned</text>

                <line x1="48" y1="128" x2={W - 48} y2="128" stroke="#ffffff" strokeOpacity="0.18" />

                {rows.map((r, i) => {
                    const y = 168 + i * 52;
                    return (
                        <g key={r.id} opacity={r.played ? 1 : 0.35}>
                            <text x="48" y={y} fill="#fbbf24" fontFamily="Helvetica, Arial, sans-serif" fontSize="18">
                                {"\u2605".repeat(r.stars)}<tspan fill="#4b5563">{"\u2605".repeat(3 - r.stars)}</tspan>
                            </text>
                            <text x="128" y={y} fill="#ffffff" fontFamily="Helvetica, Arial, sans-serif" fontSize="18" fontWeight="bold">
                                {r.city}
                            </text>
                            <text x="270" y={y} fill="#d1d5db" fontFamily="Helvetica, Arial, sans-serif" fontSize="15">
                                {r.title}
                            </text>
                            <text x={W - 48} y={y} fill={r.played ? "#a7f3d0" : "#6b7280"} fontFamily="monospace"
                                fontSize="17" textAnchor="end">
                                {r.played ? (r.irr != null ? `IRR ${(r.irr * 100).toFixed(1)}%` : "played") : "\u2014"}
                            </text>
                        </g>
                    );
                })}

                <line x1="48" y1={H - 78} x2={W - 48} y2={H - 78} stroke="#ffffff" strokeOpacity="0.18" />
                <text x="48" y={H - 44} fill="#9ca3af" fontFamily="Helvetica, Arial, sans-serif" fontSize="14">
                    {played.length} of {rows.length} cities \u00b7 Spanish market data by Fragua (Atlas Real Estate Analytics)
                </text>
                <text x={W - 48} y={H - 44} fill="#a7f3d0" fontFamily="Helvetica, Arial, sans-serif" fontSize="14"
                    textAnchor="end">refiai.allretech.org</text>
            </svg>
        );
    },
);
