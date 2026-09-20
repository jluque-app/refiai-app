"use client";

/**
 * Development Desk — Season 2 (Paris). Two doors, one J-curve.
 * Pure view over the engine's previewDevelopment(); decisions are queued into `pending`
 * and resolved by advanceQuarter() like everything else.
 *
 *   buyLand     [{ landId, price }]
 *   startBuild  [{ landId, ltc }]
 *   sellLand    [landId]
 */

import { useEffect, useMemo, useState } from "react";
import { HardHat, Landmark, MapPinned, Hourglass, ArrowDownRight, ArrowUpRight, Ban } from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { previewDevelopment } from "@/lib/game/game-engine";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

const eur = (v: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(d)}%`);
const bps = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${Math.round(v * 10000)} bps`);

type Props = { game: any; ep: any; pending: any; setPending: (fn: (p: any) => any) => void };

export default function DevelopmentDesk({ game, ep, pending, setPending }: Props) {
    const dev = ep.development;
    const [landId, setLandId] = useState<string | null>(null);
    const [offer, setOffer] = useState(0);
    const [ltc, setLtc] = useState(dev.maxLTC);

    const land = useMemo(
        () => game.landListings.find((l: any) => l.id === landId) || game.landBank.find((l: any) => l.id === landId) || null,
        [game, landId]);
    const banked = !!land?.purchasePrice;

    useEffect(() => { if (land) setOffer(Math.round(land.purchasePrice ?? land.askPrice)); }, [land]);

    const pv: any = useMemo(() => (land ? previewDevelopment(game, land.id, { offerPrice: offer, ltc } as any) : null), [game, land, offer, ltc]);

    const commitments = game.projects
        .filter((p: any) => p.phase === "construction")
        .reduce((s: number, p: any) => s + p.budgetRemaining * (1 - p.ltc), 0);
    const carryable = pv ? pv.jCurve.peakEquity + commitments <= game.cash : true;

    const queuedBuy = (id: string) => pending.buyLand?.some((b: any) => b.landId === id);
    const queuedBuild = (id: string) => pending.startBuild?.some((b: any) => b.landId === id);
    const queuedSell = (id: string) => pending.sellLand?.includes(id);

    const queue = (kind: "buy" | "buyBuild" | "build" | "sell") => {
        if (!land) return;
        setPending((p: any) => {
            const buyLand = (p.buyLand || []).filter((b: any) => b.landId !== land.id);
            const startBuild = (p.startBuild || []).filter((b: any) => b.landId !== land.id);
            const sellLand = (p.sellLand || []).filter((x: string) => x !== land.id);
            if (kind === "buy" || kind === "buyBuild") buyLand.push({ landId: land.id, price: offer });
            if (kind === "buyBuild" || kind === "build") startBuild.push({ landId: land.id, ltc });
            if (kind === "sell") sellLand.push(land.id);
            return { ...p, buyLand, startBuild, sellLand };
        });
        setLandId(null);
    };
    const unqueue = (id: string) => setPending((p: any) => ({
        ...p,
        buyLand: (p.buyLand || []).filter((b: any) => b.landId !== id),
        startBuild: (p.startBuild || []).filter((b: any) => b.landId !== id),
        sellLand: (p.sellLand || []).filter((x: string) => x !== id),
    }));

    const chart = pv ? pv.jCurve.quarters.map((q: any) => ({ q: q.q, cum: q.cumulativeEquity, phase: q.phase })) : [];

    return (
        <div className="mb-8">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-3 flex items-center gap-2">
                <MapPinned size={15} /> Land for sale
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
                Plots, not buildings. Before you buy one, run the feasibility: the desk works out what
                the finished building would be worth, what it would cost, and therefore the most the
                land can be worth to you — the residual.
            </p>
            <div className="space-y-3">
                {game.landListings.map((l: any) => {
                    const isSel = landId === l.id;
                    const q = queuedBuy(l.id);
                    return (
                        <div key={l.id} className={`border rounded-xl p-4 bg-[hsl(var(--card))] ${isSel ? "border-[hsl(var(--primary))]" : ""}`}>
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <div className="font-medium text-sm">{l.district} · {l.buildableM2.toLocaleString()} m² buildable</div>
                                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                        Ask {eur(l.askPrice)} · {eur(l.pricePerBuildableM2)}/m² buildable · hard cost {eur(l.hardCostPerM2)}/m²
                                    </div>
                                </div>
                                {q ? (
                                    <button onClick={() => unqueue(l.id)} className="text-sm px-2.5 py-1 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
                                        {queuedBuild(l.id) ? "Buying + building — undo" : "Buying — undo"}
                                    </button>
                                ) : (
                                    <button onClick={() => setLandId(isSel ? null : l.id)} className="text-sm px-3 py-1.5 rounded-full border font-medium">
                                        {isSel ? "Close" : "Run feasibility"}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {game.landListings.length === 0 && <p className="text-sm text-[hsl(var(--muted-foreground))]">No plots on the market this quarter.</p>}
            </div>

            {/* ---------- THE DESK ---------- */}
            {land && pv && (
                <div className="mt-4 border-2 border-[hsl(var(--primary))] rounded-2xl p-4 bg-[hsl(var(--card))] text-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold flex items-center gap-2"><HardHat size={16} /> Development Desk — {land.district}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pv.verdict.startsWith("GO") ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : pv.verdict.startsWith("THIN") ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"}`}>
                            {pv.verdict}
                        </span>
                    </div>

                    {/* sliders */}
                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                        <label className="block text-sm">
                            <span className="flex justify-between"><span>{banked ? "Land at cost" : "Land offer"}</span><span className="font-mono">{eur(offer)}</span></span>
                            {!banked && (
                                <input type="range" className="w-full accent-[hsl(var(--primary))]"
                                    min={Math.round(land.askPrice * (1 - land.negotiationMargin))} max={Math.round(land.askPrice * 1.05)}
                                    step={Math.max(1000, Math.round(land.askPrice / 400))} value={offer} onChange={(e) => setOffer(Number(e.target.value))} />
                            )}
                            {!banked && <span className="text-sm text-[hsl(var(--muted-foreground))]">Seller walks below {pct(1 - land.negotiationMargin, 0)} of ask (district negotiation margin)</span>}
                        </label>
                        <label className="block text-sm">
                            <span className="flex justify-between"><span>Construction loan (LTC)</span><span className="font-mono">{pct(ltc, 0)} @ {pct(pv.adcRate, 2)} floating</span></span>
                            <input type="range" className="w-full accent-[hsl(var(--primary))]" min={0} max={dev.maxLTC} step={0.05} value={ltc} onChange={(e) => setLtc(Number(e.target.value))} />
                            <span className="text-sm text-[hsl(var(--muted-foreground))]">Bank funds this share of each draw; interest is capitalised until stabilisation</span>
                        </label>
                    </div>

                    {/* two doors */}
                    <div className="grid sm:grid-cols-2 gap-3 mb-3">
                        <Door title="Front door — cost → required rent" icon={ArrowDownRight}
                            rows={[
                                ["Total development cost", eur(pv.frontDoor.totalDevelopmentCost)],
                                [`Required NOI @ ${pct(pv.exitCap * (1 + dev.requiredMarginOnCost), 2)} yield-on-cost`, eur(pv.frontDoor.requiredNOI)],
                                ["Rent you NEED", `${pv.frontDoor.requiredRentPerM2Month.toFixed(2)} €/m²/mo`],
                                ["Rent the market PAYS", `${pv.marketRentPerM2Month.toFixed(2)} €/m²/mo`],
                            ]}
                            verdict={pv.frontDoor.feasible ? `Feasible — ${pct(pv.frontDoor.cushionPct)} cushion` : `Infeasible — needs ${pct(-pv.frontDoor.cushionPct)} more rent`}
                            good={pv.frontDoor.feasible} />
                        <Door title="Back door — market rent → land you can afford" icon={ArrowUpRight}
                            rows={[
                                ["Stabilised NOI", eur(pv.backDoor.stabilizedNOI)],
                                [`Completion value @ ${pct(pv.exitCap, 2)} cap`, eur(pv.backDoor.completionValue)],
                                [`Max total cost (÷ 1 + ${pct(dev.requiredMarginOnCost, 0)} margin)`, eur(pv.backDoor.maxTotalCost)],
                                ["Residual land value", eur(pv.backDoor.residualLandValue)],
                            ]}
                            verdict={pv.backDoor.landIsCheap ? `Land ${pct(-pv.backDoor.overpayPct)} below residual` : `Overpaying by ${pct(pv.backDoor.overpayPct)}`}
                            good={!!pv.backDoor.landIsCheap} />
                    </div>

                    {/* J-curve */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-2">
                        <Metric label="Margin on cost" value={pct(pv.jCurve.marginOnCost)} tone={pv.jCurve.marginOnCost >= dev.requiredMarginOnCost ? "good" : pv.jCurve.marginOnCost > 0 ? "warn" : "bad"} />
                        <Metric label={`Yield-on-cost vs cap ${pct(pv.exitCap, 2)}`} value={`${pct(pv.jCurve.yieldOnCost, 2)} · ${bps(pv.jCurve.developmentSpread)}`} tone={pv.jCurve.developmentSpread >= dev.targetSpreadBps / 10000 ? "good" : pv.jCurve.developmentSpread > 0 ? "warn" : "bad"} />
                        <Metric label="Equity IRR (unlevered)" value={`${pct(pv.jCurve.equityIRR)} (${pct(pv.jCurve.unleveredIRR)})`} />
                        <Metric label="Capitalised interest" value={eur(pv.jCurve.capitalizedInterest)} />
                    </div>
                    <div className={`text-sm rounded-lg px-3 py-2 mb-2 flex items-center gap-2 ${carryable ? "bg-[hsl(var(--muted)/0.5)]" : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200"}`}>
                        <Landmark size={13} className="shrink-0" />
                        <span>
                            Peak equity <strong>{eur(pv.jCurve.peakEquity)}</strong> at Q{pv.jCurve.troughQuarter}
                            {commitments > 0 && <> + <strong>{eur(commitments)}</strong> already committed to live sites</>}
                            {" "}vs cash <strong>{eur(game.cash)}</strong>.
                            {!carryable && " Your balance sheet cannot carry this: raise LP equity, take a smaller site, or wait. A stalled draw ends the episode."}
                        </span>
                    </div>
                    <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="q" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(q: number) => `Q${q}`} />
                                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `${Math.round(v / 1e6 * 10) / 10}m`} width={36} />
                                <Tooltip formatter={((v: any) => eur(Number(v))) as any} labelFormatter={((q: any, p: any) => `Q${q} · ${p?.[0]?.payload?.phase ?? ""}`) as any} />
                                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                                <Area type="monotone" dataKey="cum" name="Cumulative equity" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] italic mb-3">
                        The J-curve: land, then {dev.constructionQuarters} quarters of draws, {dev.leaseUpQuarters} of lease-up, then stabilisation — shown here with a sale at completion. In the game you keep the building (take-out loan) and decide when to sell.
                    </p>

                    {/* option to wait */}
                    <div className="flex items-start gap-2 text-sm rounded-lg px-3 py-2 mb-4 border">
                        <Hourglass size={13} className="shrink-0 mt-0.5" />
                        <span>
                            <strong>Option to wait.</strong> Build now: profit {eur(pv.wait.buildNow)}. Hold the land a year (carry {eur(land.askPrice * dev.landCarryAnnual)}) and build only if rents move your way (±8%): {eur(pv.wait.waitValue)}.
                            Option premium <strong>{eur(pv.wait.optionPremium)}</strong> → <strong>{pv.wait.recommend}</strong>.
                        </span>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        {!banked ? (
                            <>
                                <button onClick={() => queue("buy")} className="text-sm px-4 py-2 rounded-full border font-medium">Buy land, hold the option</button>
                                <button onClick={() => queue("buyBuild")} className="btn btn-primary text-sm px-4 py-2 rounded-full font-medium flex items-center gap-1"><HardHat size={12} /> Buy &amp; start construction</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => queue("build")} className="btn btn-primary text-sm px-4 py-2 rounded-full font-medium flex items-center gap-1"><HardHat size={12} /> Start construction</button>
                                <button onClick={() => queue("sell")} className="text-sm px-4 py-2 rounded-full border font-medium flex items-center gap-1"><Ban size={12} /> Sell the plot ({eur(Math.max(0, land.residualLandValue) * 0.97)})</button>
                            </>
                        )}
                        <button onClick={() => setLandId(null)} className="text-sm px-3 py-2 text-[hsl(var(--muted-foreground))]">Cancel</button>
                    </div>
                </div>
            )}

            {/* ---------- LAND BANK ---------- */}
            {game.landBank.length > 0 && (
                <div className="mt-6">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2">Land bank — options you hold</h3>
                    <div className="space-y-2">
                        {game.landBank.map((l: any) => {
                            const up = l.residualLandValue - l.purchasePrice;
                            const qb = queuedBuild(l.id), qs = queuedSell(l.id);
                            return (
                                <div key={l.id} className="border rounded-xl p-3 bg-[hsl(var(--card))] text-xs flex items-center justify-between gap-2">
                                    <div>
                                        <div className="font-medium text-sm">{l.district} · {l.buildableM2.toLocaleString()} m² · held {l.heldQ ?? 0}q</div>
                                        <div className="text-[hsl(var(--muted-foreground))]">
                                            Paid {eur(l.purchasePrice)} · residual today {eur(l.residualLandValue)}{" "}
                                            <span className={up >= 0 ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--destructive))]"}>({up >= 0 ? "+" : ""}{eur(up)})</span>
                                            {" "}· carry {eur(l.purchasePrice * dev.landCarryAnnual / 4)}/q
                                        </div>
                                    </div>
                                    {qb || qs ? (
                                        <button onClick={() => unqueue(l.id)} className="px-2.5 py-1 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">{qb ? "Building — undo" : "Selling — undo"}</button>
                                    ) : (
                                        <button onClick={() => setLandId(l.id)} className="px-3 py-1.5 rounded-full border font-medium text-sm">Open desk</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Sites under construction / in lease-up — lives in the portfolio column. */
export function ProjectsPanel({ game }: { game: any }) {
    if (!game.projects?.length) return null;
    return (
        <div className="mb-6">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-2 flex items-center gap-2"><HardHat size={13} /> Sites</h3>
            <div className="space-y-2">
                {game.projects.map((p: any) => {
                    const build = p.progressQ / p.constructionQuarters;
                    const lease = p.leaseQ / p.leaseUpQuarters;
                    const remainingEquity = p.phase === "construction" ? p.budgetRemaining * (1 - p.ltc) : 0;
                    return (
                        <div key={p.id} className="border rounded-xl p-3 bg-[hsl(var(--card))] text-xs">
                            <div className="flex items-center justify-between mb-2">
                                <div className="font-medium text-sm">{p.district} · {p.buildableM2.toLocaleString()} m²</div>
                                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${p.phase === "stalled" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>{p.phase}{p.delayedQ ? ` · delayed ${p.delayedQ}q` : ""}</span>
                            </div>
                            <div className="flex gap-1 h-2 rounded-full overflow-hidden border mb-2">
                                <div className="bg-amber-400" style={{ width: `${Math.min(1, build) * 60}%` }} title="construction" />
                                <div className="bg-[hsl(var(--primary))]" style={{ width: `${Math.min(1, lease) * 40}%` }} title="lease-up" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <Metric small label="Equity in" value={eur(p.equityIn)} />
                                <Metric small label="Still to fund" value={eur(remainingEquity)} tone={remainingEquity > game.cash ? "bad" : undefined} />
                                <Metric small label={`Loan @ ${pct(p.rate, 2)}`} value={eur(p.loanBalance)} />
                                <Metric small label="Interest rolled" value={eur(p.capInt)} />
                            </div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                                Stabilised NOI {eur(p.stabilizedNOI)}/yr · occupancy {pct(p.occupancy, 0)} · TDC to date {eur(p.tdc)}{p.overruns > 0 && ` (overruns ${eur(p.overruns)})`}
                                {!p.feasibleAtStart && <span className="text-[hsl(var(--destructive))]"> · started infeasible (needed {p.requiredRentAtStart} vs {p.marketRentAtStart} €/m²)</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Door({ title, icon: Icon, rows, verdict, good }: { title: string; icon: any; rows: [string, string][]; verdict: string; good: boolean }) {
    return (
        <div className="rounded-xl border p-3">
            <div className="font-semibold text-xs mb-2 flex items-center gap-1.5"><Icon size={13} /> {title}</div>
            <table className="w-full text-sm">
                <tbody>
                    {rows.map(([k, v], i) => (
                        <tr key={k} className={i === rows.length - 1 ? "font-semibold border-t" : ""}>
                            <td className="py-0.5 text-[hsl(var(--muted-foreground))]">{k}</td>
                            <td className="py-0.5 text-right font-mono">{v}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className={`mt-2 text-xs font-medium ${good ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--destructive))]"}`}>{verdict}</div>
        </div>
    );
}

function Metric({ label, value, tone, small }: { label: string; value: string; tone?: "good" | "bad" | "warn"; small?: boolean }) {
    const color = tone === "good" ? "text-[hsl(var(--primary))]" : tone === "bad" ? "text-[hsl(var(--destructive))]" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "";
    return (
        <div className={`bg-[hsl(var(--muted)/0.5)] rounded-lg ${small ? "p-2" : "p-3"}`}>
            <div className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{label}</div>
            <div className={`font-mono font-semibold ${small ? "text-sm" : "text-base"} ${color}`}>{value}</div>
        </div>
    );
}
