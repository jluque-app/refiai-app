"use client";

/**
 * ReFiAI Tycoon — gameplay screen (Stage 2 v1).
 * All math comes from the headless engine in src/lib/game (see ASTRA_BLUEPRINT.md);
 * this file is pure view + decision assembly. Astra may later re-skin this page
 * (3D city, richer art) but must keep calling the same engine functions.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, ArrowRight, Building2, CalendarClock, CheckCircle2, ChevronRight, Coins,
    FileText, Landmark, RefreshCw, Star, TrendingUp, Users, X, AlertTriangle, Sparkles,
} from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    EPISODES, createGame, advanceQuarter, previewDeal, previewLoan, previewRefi, previewNote,
    buildingVisualState,
} from "@/lib/game/game-engine";

const eur = (v: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);

const VS_STYLE: Record<string, string> = {
    healthy: "bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]",
    watch: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    warning: "bg-amber-200 text-amber-900 dark:bg-amber-800/60 dark:text-amber-200 animate-pulse",
    default: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    boom: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const TIER_PRESETS: Record<string, { label: string; tiers: any[] }> = {
    standard: { label: "Standard 80/20 → 60/40 after 12%", tiers: [{ hurdle: 0.12, lpShare: 0.8 }, { hurdle: null, lpShare: 0.6 }] },
    gp: { label: "GP-friendly 80/20 → 50/50 after 10%", tiers: [{ hurdle: 0.10, lpShare: 0.8 }, { hurdle: null, lpShare: 0.5 }] },
    lp: { label: "LP-friendly 85/15 → 70/30 after 14%", tiers: [{ hurdle: 0.14, lpShare: 0.85 }, { hurdle: null, lpShare: 0.7 }] },
};

export default function GamePlay() {
    const params = useParams();
    const episodeId = String(params.episodeId);
    const ep: any = (EPISODES as any)[episodeId];

    const [game, setGame] = useState<any>(null);
    const [pending, setPending] = useState<any>({ bids: [], sells: [], refis: [], buyNotes: [] });
    const [selected, setSelected] = useState<string | null>(null);
    const [offer, setOffer] = useState<number>(0);
    const [loanCfg, setLoanCfg] = useState<any>({ enabled: false, pattern: "CPM", ltv: 0.7, amortYears: 25, termQuarters: 40 });
    const [lpCfg, setLpCfg] = useState<any>({ amount: 2_000_000, preset: "standard" });
    const [report, setReport] = useState<any>(null);

    const saveKey = `refiai_game_save_${episodeId}`;

    /* ---- load / create ---- */
    useEffect(() => {
        if (!ep) return;
        try {
            const saved = localStorage.getItem(saveKey);
            if (saved) { setGame(JSON.parse(saved)); return; }
        } catch { /* ignore */ }
        setGame(createGame({ episodeId, seed: Math.floor(Math.random() * 100000) + 1 }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [episodeId]);

    useEffect(() => {
        if (!game) return;
        try { localStorage.setItem(saveKey, JSON.stringify(game)); } catch { /* ignore */ }
        if (game.done && game.lastReport) {
            try {
                const prog = JSON.parse(localStorage.getItem("refiai_game_progress") || "{}");
                const stars = game.lastReport.objectives?.stars ?? 0;
                if (!prog[episodeId] || stars > prog[episodeId].stars || !game.lastReport.objectives?.failed) {
                    prog[episodeId] = { stars: Math.max(stars, prog[episodeId]?.stars ?? 0), completed: !game.lastReport.objectives?.failed || prog[episodeId]?.completed || false };
                    localStorage.setItem("refiai_game_progress", JSON.stringify(prog));
                }
            } catch { /* ignore */ }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game]);

    /* ---- derived ---- */
    const selectedListing = useMemo(
        () => game?.listings?.find((l: any) => l.id === selected) ?? null, [game, selected]);

    useEffect(() => {
        if (selectedListing) setOffer(Math.round(selectedListing.askPrice));
    }, [selectedListing]);

    const uw = useMemo(() => {
        if (!game || !selectedListing) return null;
        return previewDeal(game, selectedListing.id, { offerPrice: offer } as any) as any;
    }, [game, selectedListing, offer]);

    const loanPrev = useMemo(() => {
        if (!game || !selectedListing || !loanCfg.enabled || !ep?.debtAllowed) return null;
        return previewLoan(game, { value: offer, noiAnnual: selectedListing.noiAnnual, ...loanCfg }) as any;
    }, [game, selectedListing, offer, loanCfg, ep]);

    /* ---- actions ---- */
    const addBid = useCallback(() => {
        if (!selectedListing) return;
        setPending((p: any) => ({
            ...p,
            bids: [...p.bids.filter((b: any) => b.dealId !== selectedListing.id),
            { dealId: selectedListing.id, price: offer, loan: loanCfg.enabled ? { ...loanCfg } : undefined }],
        }));
        setSelected(null);
    }, [selectedListing, offer, loanCfg]);

    const endQuarter = useCallback(() => {
        if (!game || game.done) return;
        const decisions: any = { ...pending };
        if (ep.lpAllowed && lpCfg.queued) {
            decisions.raiseLP = { amount: lpCfg.amount, prefRate: ep.market.defaultPref, tiers: TIER_PRESETS[lpCfg.preset].tiers };
        }
        const res: any = advanceQuarter(JSON.parse(JSON.stringify(game)), decisions);
        setGame(res.state);
        setReport(res);
        setPending({ bids: [], sells: [], refis: [], buyNotes: [] });
        setLpCfg((c: any) => ({ ...c, queued: false }));
        setSelected(null);
    }, [game, pending, lpCfg, ep]);

    const restart = useCallback(() => {
        try { localStorage.removeItem(saveKey); } catch { /* ignore */ }
        setGame(createGame({ episodeId, seed: Math.floor(Math.random() * 100000) + 1 }));
        setPending({ bids: [], sells: [], refis: [], buyNotes: [] });
        setReport(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [episodeId, saveKey]);

    if (!ep) return <div className="p-10">Unknown episode. <Link className="underline" href="/game">Back</Link></div>;
    if (!game) return <div className="p-10 text-[hsl(var(--muted-foreground))]">Loading city…</div>;

    const obj = game.lastReport?.objectives;
    const pendingCount = pending.bids.length + pending.sells.length + pending.refis.length + pending.buyNotes.length + (lpCfg.queued ? 1 : 0);

    /* ================= DONE SCREEN ================= */
    if (game.done) {
        const m = game.lastReport?.metrics ?? {};
        const failed = obj?.failed;
        return (
            <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
                <h1 className="text-3xl font-bold mb-2">{failed ? "The market wins this round" : `${ep.city}: episode complete`}</h1>
                <div className="flex justify-center gap-1 my-4">
                    {[1, 2, 3].map((s) => (
                        <Star key={s} size={32} className={!failed && s <= (obj?.stars ?? 0) ? "text-[hsl(var(--brand-gold))] fill-[hsl(var(--brand-gold))]" : "text-[hsl(var(--border))]"} />
                    ))}
                </div>
                {failed && (
                    <p className="text-[hsl(var(--destructive))] font-medium mb-4">Fail state: {failed}</p>
                )}
                <div className="grid grid-cols-2 gap-3 text-left my-6">
                    <Metric label="Portfolio IRR" value={pct(m.portfolioIRR)} />
                    <Metric label="Final NAV" value={eur(game.lastReport?.nav ?? 0)} />
                    {m.lpIRR != null && <Metric label="LP net IRR" value={pct(m.lpIRR)} />}
                    {m.promotePaid > 0 && <Metric label="Promote earned" value={eur(m.promotePaid)} />}
                    {m.noteProfits !== 0 && ep.noteDeskAllowed && <Metric label="Note desk P&L" value={eur(m.noteProfits)} />}
                    <Metric label="Defaults" value={String(m.defaults ?? 0)} />
                </div>
                {failed ? (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
                        Every bust is a lesson — review what broke, or bring this run to{" "}
                        <Link href="/office-hours" className="text-[hsl(var(--primary))] underline underline-offset-2">live office hours</Link>.
                    </p>
                ) : (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
                        Chase the missing stars on a new seed, or move to the next city.
                    </p>
                )}
                <div className="flex justify-center gap-3">
                    <button onClick={restart} className="btn bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-5 py-2.5 rounded-full text-sm">Replay (new seed)</button>
                    <Link href="/game" className="btn btn-primary px-5 py-2.5 rounded-full text-sm">Episode select</Link>
                </div>
            </div>
        );
    }

    /* ================= MAIN BOARD ================= */
    return (
        <div className="container mx-auto px-4 py-6 max-w-6xl">
            {/* HUD */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 p-4 bg-[hsl(var(--card))] border rounded-2xl">
                <div className="flex items-center gap-3">
                    <Link href="/game" aria-label="Back to episodes" className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"><ArrowLeft size={18} /></Link>
                    <div>
                        <div className="font-bold leading-tight">{ep.city} — {ep.title}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">{ep.topics}</div>
                    </div>
                </div>
                <div className="flex items-center gap-5 text-sm">
                    <Hud label="Quarter" value={`${game.quarter}/${ep.quarters}`} icon={CalendarClock} />
                    <Hud label="Cash" value={eur(game.cash)} icon={Coins} warn={game.cash < 50000} />
                    <Hud label="NAV" value={eur(game.lastReport?.nav ?? game.cash)} icon={TrendingUp} />
                    <button onClick={endQuarter} className="btn btn-primary px-5 py-2.5 rounded-full text-sm flex items-center gap-2">
                        End quarter {pendingCount > 0 && <span className="bg-white/20 rounded-full px-2">{pendingCount}</span>} <ArrowRight size={15} />
                    </button>
                </div>
            </div>

            {/* Objectives */}
            <div className="flex flex-wrap gap-2 mb-6 text-xs">
                <ObjChip done={obj?.star1} label={`★ ${describeObjective(ep, "star1")}`} />
                <ObjChip done={obj?.star2} label={`★★ ${describeObjective(ep, "star2")}`} />
                <ObjChip done={obj?.star3} label={`★★★ ${describeObjective(ep, "star3")}`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* ---------- LEFT: market ---------- */}
                <section>
                    <h2 className="font-semibold text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3 flex items-center gap-2">
                        <Building2 size={15} /> On the market
                    </h2>
                    <div className="space-y-3">
                        {game.listings.map((l: any) => {
                            const isSel = selected === l.id;
                            const bid = pending.bids.find((b: any) => b.dealId === l.id);
                            return (
                                <div key={l.id} className={`border rounded-xl p-4 bg-[hsl(var(--card))] ${isSel ? "border-[hsl(var(--primary))]" : ""}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <div className="font-medium text-sm">{l.district} · {l.sizeM2} m²</div>
                                            <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                                Ask {eur(l.askPrice)} · NOI {eur(l.noiAnnual)}/yr · {eur(Math.round(l.askPrice / l.sizeM2))}/m²
                                            </div>
                                        </div>
                                        {bid ? (
                                            <span className="text-xs px-2.5 py-1 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">Bid {eur(bid.price)}</span>
                                        ) : (
                                            <button onClick={() => setSelected(isSel ? null : l.id)} className="text-sm text-[hsl(var(--primary))] font-medium flex items-center">
                                                Underwrite <ChevronRight size={15} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Deal Desk */}
                                    {isSel && uw && (
                                        <div className="mt-4 pt-4 border-t space-y-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span>Your offer</span>
                                                <span className="font-mono font-semibold">{eur(offer)}</span>
                                            </div>
                                            <input type="range" className="w-full"
                                                min={Math.round(l.askPrice * (1 - (l.negotiationMargin ?? 0.05)))}
                                                max={Math.round(l.askPrice * 1.1)}
                                                step={5000} value={offer}
                                                onChange={(e) => setOffer(Number(e.target.value))} />
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <Metric label="Intrinsic value" value={eur(uw.intrinsicValue)} small />
                                                <Metric label="NPV at offer" value={eur(uw.npv)} small tone={uw.npv >= 0 ? "good" : "bad"} />
                                                <Metric label="Unlevered IRR" value={pct(uw.irr)} small />
                                            </div>
                                            <div className={`text-center text-sm font-bold rounded-lg py-1.5 ${uw.verdict === "CHEAP" ? "bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                                                {uw.verdict === "CHEAP" ? "CHEAP — priced below intrinsic value" : "RICH — priced above intrinsic value"}
                                            </div>
                                            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                                                Seller flexibility in this district: up to {pct(l.negotiationMargin, 0)} below ask (real market data).
                                            </p>

                                            {/* Debt Desk */}
                                            {ep.debtAllowed && (
                                                <div className="pt-3 border-t space-y-2">
                                                    <label className="flex items-center gap-2 text-sm font-medium">
                                                        <input type="checkbox" checked={loanCfg.enabled}
                                                            onChange={(e) => setLoanCfg({ ...loanCfg, enabled: e.target.checked })} />
                                                        <Landmark size={15} /> Finance with a mortgage
                                                    </label>
                                                    {loanCfg.enabled && (
                                                        <>
                                                            <div className="flex gap-2 flex-wrap">
                                                                {["IO", "CPM", "CAM", "ARM"].map((p) => {
                                                                    const allowed = !ep.allowedPatterns || ep.allowedPatterns.includes(p);
                                                                    return (
                                                                        <button key={p} disabled={!allowed}
                                                                            onClick={() => setLoanCfg({ ...loanCfg, pattern: p })}
                                                                            title={allowed ? "" : "Unlocks in a later episode — as in the course"}
                                                                            className={`px-3 py-1 rounded-full text-xs border ${loanCfg.pattern === p ? "bg-[hsl(var(--primary))] text-white border-transparent" : allowed ? "bg-[hsl(var(--card))]" : "opacity-40 cursor-not-allowed"}`}>
                                                                            {p}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span>LTV target</span><span className="font-mono">{pct(loanCfg.ltv, 0)}</span>
                                                            </div>
                                                            <input type="range" className="w-full" min={0.3} max={ep.market.maxLTV ?? 0.75} step={0.01}
                                                                value={loanCfg.ltv} onChange={(e) => setLoanCfg({ ...loanCfg, ltv: Number(e.target.value) })} />
                                                            {loanPrev && !loanPrev.rejected && (
                                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                                    <Metric small label={`Proceeds (binds on ${loanPrev.constraint})`} value={eur(loanPrev.proceeds)} />
                                                                    <Metric small label={`Rate (${loanPrev.pattern})`} value={pct(loanPrev.rate, 2)} />
                                                                    <Metric small label="Year-1 DSCR" value={loanPrev.dscrYear1 === Infinity ? "∞" : loanPrev.dscrYear1.toFixed(2)}
                                                                        tone={loanPrev.dscrYear1 < 1.2 ? "bad" : loanPrev.dscrYear1 < 1.3 ? "warn" : "good"} />
                                                                    <Metric small label="Balloon at term" value={eur(loanPrev.balloon)} />
                                                                    {loanPrev.pointsCost > 0 && <Metric small label="Origination points" value={eur(loanPrev.pointsCost)} tone="warn" />}
                                                                    <Metric small label="Equity needed" value={eur(Math.max(0, offer - loanPrev.proceeds + (loanPrev.pointsCost || 0)))} />
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            <button onClick={addBid}
                                                disabled={loanCfg.enabled && (!loanPrev || loanPrev.rejected)}
                                                className="btn btn-primary w-full justify-center text-sm py-2.5 rounded-xl disabled:opacity-50">
                                                Place bid at {eur(offer)}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {game.listings.length === 0 && (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Nothing listed this quarter — the market breathes.</p>
                        )}
                    </div>

                    {/* Note desk */}
                    {ep.noteDeskAllowed && (
                        <div className="mt-8">
                            <h2 className="font-semibold text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3 flex items-center gap-2">
                                <FileText size={15} /> Note desk — mortgage paper for sale
                            </h2>
                            <div className="space-y-3">
                                {game.noteListings.map((n: any) => {
                                    const pv: any = previewNote(game, n.id);
                                    const queued = pending.buyNotes.some((b: any) => b.noteId === n.id);
                                    const discount = pv ? pv.fairValue - n.askPrice : 0;
                                    return (
                                        <div key={n.id} className="border rounded-xl p-4 bg-[hsl(var(--card))] text-sm">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <div className="font-medium">Balance {eur(n.balance)} · coupon {pct(n.coupon, 2)}</div>
                                                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                                        Ask {eur(n.askPrice)} · fair value (PV @ {pct(pv?.yieldAnnual, 2)}) {eur(pv?.fairValue ?? 0)}
                                                    </div>
                                                </div>
                                                {queued ? (
                                                    <span className="text-xs px-2.5 py-1 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">Buying</span>
                                                ) : (
                                                    <button
                                                        onClick={() => setPending((p: any) => ({ ...p, buyNotes: [...p.buyNotes, { noteId: n.id }] }))}
                                                        className={`text-xs px-3 py-1.5 rounded-full font-medium ${discount >= 0 ? "bg-[hsl(var(--primary))] text-white" : "border text-[hsl(var(--muted-foreground))]"}`}>
                                                        {discount >= 0 ? `Buy (${eur(discount)} cheap)` : "Buy anyway"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {game.noteListings.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No paper on offer this quarter.</p>}
                            </div>
                        </div>
                    )}
                </section>

                {/* ---------- RIGHT: portfolio ---------- */}
                <section>
                    <h2 className="font-semibold text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3 flex items-center gap-2">
                        <TrendingUp size={15} /> Your portfolio
                    </h2>
                    <div className="space-y-3">
                        {game.assets.map((a: any) => {
                            const vs = buildingVisualState(a);
                            const refi: any = a.loan ? previewRefi(game, a.id) : null;
                            const selling = pending.sells.includes(a.id);
                            const refiing = pending.refis.includes(a.id);
                            return (
                                <div key={a.id} className="border rounded-xl p-4 bg-[hsl(var(--card))] text-sm">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="font-medium">{a.district ?? a.type} · bought {eur(a.purchasePrice)}</div>
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize ${VS_STYLE[vs] ?? "bg-[hsl(var(--muted))]"}`}>{vs}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                                        <Metric small label="Value" value={eur(a.value)} />
                                        <Metric small label="NOI / yr" value={eur(a.noiAnnual)} />
                                        <Metric small label={a.loan ? `DSCR (${a.loan.pattern})` : "DSCR"} value={a.loan ? (a.dscr ? a.dscr.toFixed(2) : "—") : "no debt"}
                                            tone={a.loan && a.dscr && a.dscr < 1.2 ? "bad" : a.loan && a.dscr && a.dscr < 1.3 ? "warn" : undefined} />
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        <button onClick={() => setPending((p: any) => ({ ...p, sells: selling ? p.sells.filter((x: string) => x !== a.id) : [...p.sells, a.id] }))}
                                            className={`text-xs px-3 py-1.5 rounded-full border ${selling ? "bg-[hsl(var(--destructive))] text-white border-transparent" : ""}`}>
                                            {selling ? "Selling — undo" : `Sell (net ${eur(Math.round(a.value * 0.98 - (a.loan?.balance ?? 0)))})`}
                                        </button>
                                        {a.loan && refi && (
                                            <button onClick={() => setPending((p: any) => ({ ...p, refis: refiing ? p.refis.filter((x: string) => x !== a.id) : [...p.refis, a.id] }))}
                                                className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1 ${refiing ? "bg-[hsl(var(--primary))] text-white border-transparent" : ""}`}>
                                                <RefreshCw size={12} /> {refiing ? "Refinancing — undo" : `Refi @ ${pct(refi.newRate, 2)} (NPV ${eur(refi.npv)})`}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {game.assets.length === 0 && (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">No assets yet — underwrite something on the left. Buy cheap; the market rewards discipline.</p>
                        )}
                    </div>

                    {/* Owned notes */}
                    {ep.noteDeskAllowed && game.notes.length > 0 && (
                        <div className="mt-6">
                            <h3 className="font-semibold text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Notes owned</h3>
                            {game.notes.map((n: any) => (
                                <div key={n.id} className="text-xs border rounded-lg p-3 mb-2 bg-[hsl(var(--card))]">
                                    Balance {eur(n.balance)} · coupon {pct(n.coupon, 2)} · cost {eur(n.costBasis)}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* LP panel */}
                    {ep.lpAllowed && game.fund && (
                        <div className="mt-8 border rounded-xl p-4 bg-[hsl(var(--card))]">
                            <h2 className="font-semibold text-sm flex items-center gap-2 mb-2"><Users size={15} /> LP capital</h2>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
                                Raised {eur(game.fund.lpEquity)} of {eur(ep.market.lpPool)} available · pref {pct(ep.market.defaultPref, 0)}
                            </p>
                            <div className="flex gap-2 items-center flex-wrap text-xs">
                                <input type="number" className="border rounded-lg px-3 py-2 w-32 bg-transparent" step={500000} min={500000}
                                    value={lpCfg.amount} onChange={(e) => setLpCfg({ ...lpCfg, amount: Number(e.target.value) })} />
                                <select className="border rounded-lg px-2 py-2 bg-transparent" value={lpCfg.preset}
                                    onChange={(e) => setLpCfg({ ...lpCfg, preset: e.target.value })}>
                                    {Object.entries(TIER_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                                <button onClick={() => setLpCfg({ ...lpCfg, queued: !lpCfg.queued })}
                                    className={`px-3 py-2 rounded-full border font-medium ${lpCfg.queued ? "bg-[hsl(var(--primary))] text-white border-transparent" : ""}`}>
                                    {lpCfg.queued ? "Raising — undo" : "Raise this quarter"}
                                </button>
                            </div>
                            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-2">
                                The waterfall you pick here is enforced at every distribution — design terms both sides can live with.
                            </p>
                        </div>
                    )}
                </section>
            </div>

            {/* ---------- Quarterly report drawer ---------- */}
            {report && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setReport(null)} />
                    <div className="relative bg-[hsl(var(--card))] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border shadow-2xl max-h-[85vh] overflow-y-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-lg">Quarter {report.report?.quarter} report</h2>
                            <button onClick={() => setReport(null)} aria-label="Close"><X size={18} /></button>
                        </div>
                        {report.events?.map((e: any) => (
                            <div key={e.id} className={`mb-3 p-3 rounded-xl text-sm flex gap-2 ${e.severity === "crisis" ? "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" : e.severity === "warning" ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" : "bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"}`}>
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <div><strong>{e.name}.</strong> {e.text}</div>
                            </div>
                        ))}
                        <div className="grid grid-cols-2 gap-2 text-sm my-4">
                            <Metric label="NOI collected" value={eur(report.report?.noiQ ?? 0)} />
                            <Metric label="Debt service" value={eur(report.report?.debtServiceQ ?? 0)} />
                            <Metric label="Cash flow (BTCF)" value={eur(report.report?.btcfQ ?? 0)} tone={(report.report?.btcfQ ?? 0) >= 0 ? "good" : "bad"} />
                            <Metric label="NAV" value={eur(report.report?.nav ?? 0)} />
                        </div>
                        {report.triggers?.map((t: any) => (
                            <div key={t.id} className="mb-3 p-3 rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--secondary))] text-sm">
                                <div className="flex items-center gap-2 font-semibold text-[hsl(var(--primary))] mb-1">
                                    <Sparkles size={14} /> The Professor: {t.title}
                                </div>
                                <p className="mb-2">{t.body}</p>
                                <div className="flex gap-3 text-xs">
                                    {t.lessonUrl && <Link className="underline text-[hsl(var(--primary))]" href={t.lessonUrl}>Open the lesson</Link>}
                                    {t.officeHoursUrl && <Link className="underline text-[hsl(var(--primary))]" href={t.officeHoursUrl}>Office hours</Link>}
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setReport(null)} className="btn btn-primary w-full justify-center py-2.5 rounded-xl text-sm mt-2">
                            <CheckCircle2 size={15} className="mr-1" /> Continue
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ---------- tiny presentational helpers ---------- */
function Hud({ label, value, icon: Icon, warn }: { label: string; value: string; icon: any; warn?: boolean }) {
    return (
        <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-1 justify-end"><Icon size={11} /> {label}</div>
            <div className={`font-mono font-semibold text-sm ${warn ? "text-[hsl(var(--destructive))]" : ""}`}>{value}</div>
        </div>
    );
}

function Metric({ label, value, tone, small }: { label: string; value: string; tone?: "good" | "bad" | "warn"; small?: boolean }) {
    const color = tone === "good" ? "text-[hsl(var(--primary))]" : tone === "bad" ? "text-[hsl(var(--destructive))]" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "";
    return (
        <div className={`bg-[hsl(var(--muted)/0.5)] rounded-lg ${small ? "p-2" : "p-3"}`}>
            <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{label}</div>
            <div className={`font-mono font-semibold ${small ? "text-xs" : "text-sm"} ${color}`}>{value}</div>
        </div>
    );
}

function ObjChip({ done, label }: { done?: boolean; label: string }) {
    return (
        <span className={`px-2.5 py-1 rounded-full border ${done ? "bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] border-transparent" : "text-[hsl(var(--muted-foreground))]"}`}>
            {done ? "✓ " : ""}{label}
        </span>
    );
}

/** Human description of an objective rule (kept in sync with episodes.js). */
function describeObjective(ep: any, key: "star1" | "star2" | "star3"): string {
    const DESCR: Record<string, Record<string, string>> = {
        E1_VALENCIA: { star1: "Unlevered IRR ≥ 8%", star2: "IRR ≥ 10% + one sale above intrinsic", star3: "Never buy at negative NPV" },
        E2_MADRID: { star1: "IRR ≥ 12%, zero defaults", star2: "No covenant breaches", star3: "IRR ≥ 15% + perfect underwriting" },
        E3_BARCELONA: { star1: "LP IRR ≥ 12% and GP multiple ≥ 2×", star2: "LP IRR ≥ 12% through a rent cap", star3: "Promote ≥ €1.5m, pref always paid" },
        E4_MIAMI: { star1: "Levered IRR ≥ 15%, zero defaults", star2: "Use 3+ mortgage patterns", star3: "No covenant breaches" },
        E5_NYC: { star1: "IRR ≥ 12% + one NPV-positive refi", star2: "Note desk profit ≥ €200k", star3: "Never overpay for a note" },
        E6_LONDON: { star1: "Fund IRR ≥ 12%, 5+ assets held", star2: "Securitize at senior DSCR ≥ 1.5", star3: "IRR ≥ 15%, no tranche impairments" },
    };
    return DESCR[ep.id]?.[key] ?? "";
}
