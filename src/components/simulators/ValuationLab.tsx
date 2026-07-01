"use client";

import { useState, useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import clsx from "clsx";

/**
 * ValuationLab — Unit 1 "gold-standard" interactive lab.
 * Property proforma (PGI -> NOI), Direct Capitalization and DCF valuation,
 * plus leverage: levered IRR, equity multiple, DSCR, and positive/negative
 * leverage detection. Mirrors the patterns in PropertyValuation.tsx
 * (hsl(var(--...)) tokens, recharts, useMemo) and adds no new dependencies.
 */

interface Inputs {
    pgi: number;
    vacancyRate: number;   // %
    opexRatio: number;     // % of EGI
    capRate: number;       // % going-in
    discountRate: number;  // % required return r
    growthRate: number;    // % NOI growth g
    holdYears: number;
    exitCapRate: number;   // %
    ltv: number;           // %
    mortgageRate: number;  // %
}

const BASE: Inputs = {
    pgi: 100000,
    vacancyRate: 5,
    opexRatio: 35,
    capRate: 6.5,
    discountRate: 8,
    growthRate: 2,
    holdYears: 5,
    exitCapRate: 7,
    ltv: 60,
    mortgageRate: 5,
};

const AMORT_YEARS = 25;
const SELLING_COST = 0.02;

const eur = (v: number) =>
    new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const eurK = (v: number) =>
    Math.abs(v) >= 1000 ? `€${Math.round(v / 1000)}k` : eur(v);

// Excel-style PMT (mirrors finance-math.ts)
function pmt(rate: number, nper: number, pv: number, fv = 0): number {
    if (nper === 0) return 0;
    if (rate === 0) return -(pv + fv) / nper;
    const f = Math.pow(1 + rate, nper);
    return -(rate * (fv + pv * f)) / (f - 1);
}

// IRR via Newton-Raphson (mirrors finance-math.ts)
function irr(cf: number[], guess = 0.12): number {
    if (cf.every((c) => c >= 0) || cf.every((c) => c <= 0)) return NaN;
    let r = guess;
    for (let i = 0; i < 200; i++) {
        let np = 0;
        let d = 0;
        for (let t = 0; t < cf.length; t++) {
            const den = Math.pow(1 + r, t);
            np += cf[t] / den;
            d -= (t * cf[t]) / (den * (1 + r));
        }
        if (Math.abs(d) < 1e-12) break;
        const nr = r - np / d;
        if (Math.abs(nr - r) < 1e-7) return nr;
        r = nr;
        if (r <= -1) r = -0.99;
        if (r > 5) r = 5;
    }
    return r;
}

function loanBalance(P: number, rate: number, amortYrs: number, afterYrs: number): number {
    const p = -pmt(rate, amortYrs, P);
    let b = P;
    for (let t = 0; t < afterYrs; t++) {
        const i = b * rate;
        b = b - (p - i);
    }
    return Math.max(b, 0);
}

export default function ValuationLab() {
    const [inp, setInp] = useState<Inputs>(BASE);
    const set = (k: keyof Inputs, v: number) => setInp((p) => ({ ...p, [k]: v }));
    const reset = () => setInp(BASE);

    const r = useMemo(() => {
        const vac = inp.vacancyRate / 100;
        const oer = inp.opexRatio / 100;
        const cap = inp.capRate / 100;
        const disc = inp.discountRate / 100;
        const g = inp.growthRate / 100;
        const exitc = inp.exitCapRate / 100;
        const ltv = inp.ltv / 100;
        const mr = inp.mortgageRate / 100;
        const hold = Math.round(inp.holdYears);

        const egi = inp.pgi * (1 - vac);
        const opex = egi * oer;
        const noi = egi - opex;

        const directCapValue = noi / cap;
        const price = directCapValue;
        const loan = price * ltv;
        const equity0 = price - loan;
        const ds = ltv > 0 ? -pmt(mr, AMORT_YEARS, loan) : 0;
        const dscr = ds > 0 ? noi / ds : Infinity;

        // Equity cash flows
        const equityCF: number[] = [-equity0];
        const chart: { year: string; cf: number }[] = [{ year: "Yr 0", cf: -equity0 }];
        for (let t = 1; t <= hold; t++) {
            const noiT = noi * Math.pow(1 + g, t - 1);
            let cf = noiT - ds;
            if (t === hold) {
                const exitNOI = noi * Math.pow(1 + g, hold);
                const sale = exitNOI / exitc;
                const saleNet = sale * (1 - SELLING_COST);
                const bal = ltv > 0 ? loanBalance(loan, mr, AMORT_YEARS, hold) : 0;
                cf = noiT - ds + (saleNet - bal);
            }
            equityCF.push(cf);
            chart.push({ year: `${t}`, cf });
        }

        // Unlevered DCF value
        let dcf = 0;
        for (let t = 1; t <= hold; t++) dcf += (noi * Math.pow(1 + g, t - 1)) / Math.pow(1 + disc, t);
        const exitNOI = noi * Math.pow(1 + g, hold);
        const saleNetU = (exitNOI / exitc) * (1 - SELLING_COST);
        dcf += saleNetU / Math.pow(1 + disc, hold);

        const leveredIRR = irr(equityCF, 0.12);
        const inflow = equityCF.slice(1).reduce((a, b) => a + b, 0);
        const equityMultiple = equity0 !== 0 ? inflow / equity0 : 0;
        const positiveLeverage = mr < cap;

        return {
            egi, opex, noi, directCapValue, dcf, price, loan, equity0, ds, dscr,
            equityCF, chart, leveredIRR, equityMultiple, positiveLeverage, hold, cap, mr, exitc,
        };
    }, [inp]);

    const Slider = ({
        label, k, min, max, step, fmt,
    }: { label: string; k: keyof Inputs; min: number; max: number; step: number; fmt: (v: number) => string }) => (
        <div>
            <div className="flex justify-between text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">
                <span>{label}</span>
                <span className="font-mono text-[hsl(var(--foreground))]">{fmt(inp[k])}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={inp[k]}
                onChange={(e) => set(k, Number(e.target.value))}
                className="w-full accent-[hsl(var(--primary))]"
            />
        </div>
    );

    return (
        <div className="space-y-6 p-1">
            <div>
                <h2 className="text-xl font-bold mb-1 flex items-center gap-2">🧮 Property Valuation &amp; Leverage Lab</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Adjust the assumptions. The proforma, both valuations, and the levered return recompute instantly —
                    the in-browser version of the class Excel model.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Inputs */}
                <div className="space-y-3 bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-2">Assumptions</div>
                    <Slider label="Potential Gross Income" k="pgi" min={40000} max={200000} step={1000} fmt={eur} />
                    <Slider label="Vacancy rate" k="vacancyRate" min={0} max={25} step={0.5} fmt={(v) => `${v.toFixed(1)}%`} />
                    <Slider label="Operating expense ratio" k="opexRatio" min={20} max={55} step={1} fmt={(v) => `${v.toFixed(0)}%`} />
                    <Slider label="Going-in cap rate (R₀)" k="capRate" min={3.5} max={10} step={0.05} fmt={(v) => `${v.toFixed(2)}%`} />
                    <Slider label="Required return (r)" k="discountRate" min={5} max={14} step={0.1} fmt={(v) => `${v.toFixed(1)}%`} />
                    <Slider label="NOI growth (g)" k="growthRate" min={-2} max={6} step={0.1} fmt={(v) => `${v.toFixed(1)}%`} />
                    <Slider label="Hold period (years)" k="holdYears" min={3} max={10} step={1} fmt={(v) => `${v} yrs`} />
                    <Slider label="Exit cap rate" k="exitCapRate" min={4} max={10} step={0.05} fmt={(v) => `${v.toFixed(2)}%`} />
                    <Slider label="Loan-to-Value (LTV)" k="ltv" min={0} max={80} step={1} fmt={(v) => `${v.toFixed(0)}%`} />
                    <Slider label="Mortgage rate" k="mortgageRate" min={2} max={9} step={0.1} fmt={(v) => `${v.toFixed(1)}%`} />
                    <button
                        onClick={reset}
                        className="w-full mt-2 text-xs font-bold border border-[hsl(var(--border))] rounded px-3 py-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:border-[hsl(var(--primary))] transition-colors"
                    >
                        ↺ Reset to base case
                    </button>
                </div>

                {/* Outputs */}
                <div className="lg:col-span-2 space-y-4">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Kpi label="Value · Direct Cap" value={eurK(r.directCapValue)} sub="NOI₁ ÷ cap rate" tone="primary" />
                        <Kpi label="Value · DCF" value={eurK(r.dcf)} sub={`${r.hold}-yr hold`} tone="secondary" />
                        <Kpi label="Levered IRR" value={isNaN(r.leveredIRR) ? "n/a" : `${(r.leveredIRR * 100).toFixed(1)}%`} sub={inp.ltv > 0 ? `${inp.ltv}% LTV` : "unlevered"} tone="amber" />
                        <Kpi label="Equity Multiple" value={`${r.equityMultiple.toFixed(2)}×`} sub={`over ${r.hold} yrs`} tone="violet" />
                    </div>

                    {/* Proforma */}
                    <div className="border border-[hsl(var(--border))] rounded-[var(--radius)] overflow-hidden">
                        <table className="w-full text-sm">
                            <tbody>
                                <PfRow label="Potential Gross Income" formula="contract + market rent" value={eur(inp.pgi)} />
                                <PfRow label={`− Vacancy (${inp.vacancyRate.toFixed(1)}%)`} formula="% × PGI" value={`(${eur(inp.pgi * inp.vacancyRate / 100).replace("€", "€")})`} />
                                <PfRow label="= Effective Gross Income" value={eur(r.egi)} total />
                                <PfRow label={`− Operating Expenses (${inp.opexRatio.toFixed(0)}%)`} formula="% × EGI" value={`(${eur(r.opex)})`} />
                                <PfRow label="= Net Operating Income" value={eur(r.noi)} total />
                                <PfRow label={`Implied value @ ${inp.capRate.toFixed(2)}% cap`} formula="NOI₁ ÷ cap rate" value={eur(r.directCapValue)} />
                            </tbody>
                        </table>
                    </div>

                    {/* Leverage line */}
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {inp.ltv > 0
                            ? `Loan ${eurK(r.loan)} · equity ${eurK(r.equity0)} · annual debt service ${eurK(r.ds)} · DSCR ${r.dscr === Infinity ? "—" : r.dscr.toFixed(2)}×`
                            : "All-equity deal — no leverage applied."}
                    </div>

                    {/* Equity cash flow chart */}
                    <div className="h-[220px] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4">
                        <h3 className="text-xs font-bold mb-3 uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Equity cash flow</h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={r.chart}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="year" fontSize={11} />
                                <YAxis tickFormatter={(v) => `€${Math.round(v / 1000)}k`} fontSize={11} width={48} />
                                <Tooltip formatter={(v: number | undefined) => (v !== undefined ? eur(v) : "")} cursor={{ fill: "transparent" }} />
                                <Bar dataKey="cf" radius={[3, 3, 0, 0]}>
                                    {r.chart.map((d, i) => (
                                        <Cell key={i} fill={d.cf < 0 ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Insight */}
                    <div className={clsx(
                        "text-sm rounded-[var(--radius)] border-l-4 px-4 py-3",
                        inp.ltv === 0
                            ? "border-[hsl(var(--brand-blue))] bg-[hsl(var(--brand-blue)/0.08)]"
                            : r.positiveLeverage
                                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)]"
                                : "border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.08)]"
                    )}>
                        {inp.ltv === 0 ? (
                            <>This is an <b>all-cash</b> deal: levered IRR equals the unlevered return. Add LTV to see leverage at work.</>
                        ) : r.positiveLeverage ? (
                            <>Mortgage rate ({inp.mortgageRate.toFixed(1)}%) is <b>below</b> the cap rate ({inp.capRate.toFixed(2)}%) → <b>positive leverage</b>: debt is lifting your equity IRR to {(r.leveredIRR * 100).toFixed(1)}%.{r.dscr !== Infinity && r.dscr < 1.25 ? ` ⚠️ DSCR is ${r.dscr.toFixed(2)}× — most lenders want ≥ 1.25×.` : ""}</>
                        ) : (
                            <>Mortgage rate ({inp.mortgageRate.toFixed(1)}%) is <b>above</b> the cap rate ({inp.capRate.toFixed(2)}%) → <b>negative leverage</b>: debt is now diluting equity returns. Compare the IRR with LTV at 0%.{r.dscr !== Infinity && r.dscr < 1.25 ? ` ⚠️ DSCR is ${r.dscr.toFixed(2)}× — most lenders want ≥ 1.25×.` : ""}</>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "primary" | "secondary" | "amber" | "violet" }) {
    const color =
        tone === "primary" ? "text-[hsl(var(--primary))]"
            : tone === "secondary" ? "text-[hsl(var(--brand-blue))]"
                : tone === "amber" ? "text-amber-500"
                    : "text-violet-500";
    return (
        <div className="bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-bold">{label}</div>
            <div className={clsx("text-xl font-extrabold font-mono mt-1", color)}>{value}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</div>
        </div>
    );
}

function PfRow({ label, formula, value, total }: { label: string; formula?: string; value: string; total?: boolean }) {
    return (
        <tr className={clsx("border-b border-[hsl(var(--border))] last:border-0", total && "bg-[hsl(var(--muted)/0.25)] font-bold")}>
            <td className="px-3 py-2 text-[hsl(var(--foreground))]">{label}</td>
            <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] hidden sm:table-cell">{formula || ""}</td>
            <td className="px-3 py-2 text-right font-mono text-[hsl(var(--foreground))]">{value}</td>
        </tr>
    );
}
