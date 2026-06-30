"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

/**
 * LoanDecisionLab — Unit 3 lab for II.6 (loan yields & mortgage valuation),
 * II.7 (prepayment), and II.8 (refinancing). Three tabs:
 *   • Effective Yield — lender's realized yield with points & prepayment
 *   • Loan Valuation  — secondary-market value (premium/discount) at a market yield
 *   • Refinance       — compare two loans (rate + points) over a holding horizon
 * In-page versions of the CREFI II.6 / II.7 / II.8 Excel models.
 */

const eur = (v: number) => new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
const pct2 = (v: number) => `${(v * 100).toFixed(2)}%`;

function annuity(balance: number, mRate: number, n: number): number {
  if (n <= 0) return balance;
  if (mRate === 0) return balance / n;
  return (balance * mRate) / (1 - Math.pow(1 + mRate, -n));
}
function balanceAfter(loan: number, mRate: number, payment: number, k: number): number {
  if (mRate === 0) return Math.max(loan - payment * k, 0);
  const f = Math.pow(1 + mRate, k);
  return Math.max(loan * f - payment * ((f - 1) / mRate), 0);
}
// IRR on a monthly cash-flow array; returns monthly rate
function irrMonthly(cf: number[], guess = 0.006): number {
  let r = guess;
  for (let i = 0; i < 200; i++) {
    let np = 0, d = 0;
    for (let t = 0; t < cf.length; t++) {
      const den = Math.pow(1 + r, t);
      np += cf[t] / den;
      d -= (t * cf[t]) / (den * (1 + r));
    }
    if (Math.abs(d) < 1e-12) break;
    const nr = r - np / d;
    if (Math.abs(nr - r) < 1e-9) return nr;
    r = nr;
    if (r <= -0.99) r = -0.99;
  }
  return r;
}

type Tab = "yield" | "value" | "refi";
const inputCls = "w-28 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-2 py-1.5 text-sm font-mono text-[hsl(var(--primary))]";

function Field({ label, value, onChange, step = 0.1, min = 0, max = 100 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <label className="text-sm">
      <span className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className={inputCls} />
    </label>
  );
}
function Kpi({ label, value, sub, tone = "primary" }: { label: string; value: string; sub?: string; tone?: "primary" | "secondary" | "amber" }) {
  const color = tone === "secondary" ? "text-[hsl(var(--secondary))]" : tone === "amber" ? "text-amber-500" : "text-[hsl(var(--primary))]";
  return (
    <div className="bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-bold">{label}</div>
      <div className={clsx("text-xl font-extrabold font-mono mt-1", color)}>{value}</div>
      {sub && <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function LoanDecisionLab() {
  const [tab, setTab] = useState<Tab>("yield");

  // --- II.6 / II.7 Effective yield ---
  const [y, setY] = useState({ loan: 2000000, coupon: 7.5, amort: 30, points: 2, prepay: 8, penalty: 0 });
  const yieldRes = useMemo(() => {
    const r = y.coupon / 100 / 12;
    const n = Math.round(y.amort * 12);
    const pay = annuity(y.loan, r, n);
    const net = y.loan * (1 - y.points / 100);
    const k = Math.round(y.prepay * 12);
    const olb = balanceAfter(y.loan, r, pay, k);
    const cf = [-net];
    for (let m = 1; m <= k; m++) cf.push(m === k ? pay + olb + (y.penalty / 100) * olb : pay);
    const eff = irrMonthly(cf, r) * 12;
    return { pay, net, olb, eff };
  }, [y]);

  // --- II.6 Loan valuation (secondary market) ---
  const [v, setV] = useState({ loan: 2000000, coupon: 8, amort: 15, age: 2, market: 7.25 });
  const valRes = useMemo(() => {
    const r = v.coupon / 100 / 12;
    const n = Math.round(v.amort * 12);
    const pay = annuity(v.loan, r, n);
    const k = Math.round(v.age * 12);
    const bal = balanceAfter(v.loan, r, pay, k);
    const remaining = n - k;
    const my = v.market / 100 / 12;
    const pvFactor = my === 0 ? remaining : (1 - Math.pow(1 + my, -remaining)) / my;
    const mktValue = pay * pvFactor;
    return { pay, bal, remaining, mktValue, prem: mktValue - bal };
  }, [v]);

  // --- II.8 Refinance / loan choice ---
  const [rf, setRf] = useState({ loan: 100000, amort: 30, horizon: 5, aRate: 6, aPoints: 4, bRate: 6.75, bPoints: 0.5 });
  const refiRes = useMemo(() => {
    const n = Math.round(rf.amort * 12);
    const k = Math.round(rf.horizon * 12);
    const cost = (rate: number, points: number) => {
      const r = rate / 100 / 12;
      const pay = annuity(rf.loan, r, n);
      const net = rf.loan * (1 - points / 100);
      const olb = balanceAfter(rf.loan, r, pay, k);
      const cf = [-net];
      for (let m = 1; m <= k; m++) cf.push(m === k ? pay + olb : pay);
      return { eff: irrMonthly(cf, r) * 12, pay };
    };
    const A = cost(rf.aRate, rf.aPoints);
    const B = cost(rf.bRate, rf.bPoints);
    return { A, B, winner: A.eff <= B.eff ? "A" : "B" };
  }, [rf]);

  return (
    <div className="space-y-5 p-1">
      <div>
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2">🧮 Loan Yield, Valuation &amp; Refinancing</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Three calculators in one — the in-page versions of your II.6, II.7 and II.8 models.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([["yield", "Effective Yield (II.6/II.7)"], ["value", "Loan Valuation (II.6)"], ["refi", "Refinance / Choice (II.8)"]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={clsx("px-3 py-2 rounded-lg text-sm font-semibold border transition-colors", tab === t ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-transparent" : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]")}>{label}</button>
        ))}
      </div>

      {tab === "yield" && (
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--foreground))] bg-[hsl(var(--muted)/0.3)] border-l-2 border-[hsl(var(--primary))] rounded-r px-3 py-2">The lender's <b>effective yield</b> rises above the coupon when the loan is disbursed with <b>points</b> (less cash advanced) and when a <b>prepayment penalty</b> is charged — especially over a short prepayment horizon.</p>
          <div className="flex flex-wrap gap-5 bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4">
            <Field label="Loan amount" value={y.loan} onChange={(x) => setY({ ...y, loan: x })} step={50000} max={100000000} />
            <Field label="Coupon rate (%)" value={y.coupon} onChange={(x) => setY({ ...y, coupon: x })} max={20} />
            <Field label="Amortization (yrs)" value={y.amort} onChange={(x) => setY({ ...y, amort: x })} step={1} max={40} />
            <Field label="Points (%)" value={y.points} onChange={(x) => setY({ ...y, points: x })} step={0.5} max={10} />
            <Field label="Prepay in year" value={y.prepay} onChange={(x) => setY({ ...y, prepay: x })} step={1} max={40} />
            <Field label="Prepay penalty (%)" value={y.penalty} onChange={(x) => setY({ ...y, penalty: x })} step={0.5} max={10} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Effective yield" value={pct(yieldRes.eff)} sub="lender's realized (nominal annual)" tone="amber" />
            <Kpi label="Coupon" value={pct2(y.coupon / 100)} sub="contract rate" />
            <Kpi label="Net disbursed" value={eur(yieldRes.net)} sub={`after ${y.points}% points`} />
            <Kpi label="Balance at prepay" value={eur(yieldRes.olb)} sub={`year ${y.prepay}`} />
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Try the ladder: 0 → 1 → 2 points (then add a 1% penalty) on a €2m, 7.5%, 30-yr loan prepaid in year 8.</p>
        </div>
      )}

      {tab === "value" && (
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--foreground))] bg-[hsl(var(--muted)/0.3)] border-l-2 border-[hsl(var(--primary))] rounded-r px-3 py-2">A seasoned loan's <b>market value</b> is the present value of its remaining payments at <b>today's market yield</b>. If the market yield is below the coupon, the loan trades at a <b>premium</b>; above it, a <b>discount</b>.</p>
          <div className="flex flex-wrap gap-5 bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4">
            <Field label="Original loan" value={v.loan} onChange={(x) => setV({ ...v, loan: x })} step={50000} max={100000000} />
            <Field label="Coupon rate (%)" value={v.coupon} onChange={(x) => setV({ ...v, coupon: x })} max={20} />
            <Field label="Amortization (yrs)" value={v.amort} onChange={(x) => setV({ ...v, amort: x })} step={1} max={40} />
            <Field label="Loan age (yrs)" value={v.age} onChange={(x) => setV({ ...v, age: x })} step={1} max={40} />
            <Field label="Market yield (%)" value={v.market} onChange={(x) => setV({ ...v, market: x })} max={20} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Market value" value={eur(valRes.mktValue)} sub="PV at market yield" tone="secondary" />
            <Kpi label="Outstanding balance" value={eur(valRes.bal)} sub={`after ${v.age} yrs`} />
            <Kpi label="Premium / (discount)" value={(valRes.prem >= 0 ? "+" : "") + eur(valRes.prem)} sub={valRes.prem >= 0 ? "trades above par" : "trades below par"} tone="amber" />
            <Kpi label="Monthly payment" value={eur(valRes.pay)} sub={`${valRes.remaining} payments left`} />
          </div>
        </div>
      )}

      {tab === "refi" && (
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--foreground))] bg-[hsl(var(--muted)/0.3)] border-l-2 border-[hsl(var(--primary))] rounded-r px-3 py-2">Choosing between a low-rate/high-points loan and a higher-rate/low-points loan is a <b>holding-horizon</b> decision. The lab computes each option's <b>effective cost</b> over your horizon — the longer you hold, the more it pays to buy down the rate with points.</p>
          <div className="flex flex-wrap gap-5 bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4">
            <Field label="Loan amount" value={rf.loan} onChange={(x) => setRf({ ...rf, loan: x })} step={10000} max={100000000} />
            <Field label="Amortization (yrs)" value={rf.amort} onChange={(x) => setRf({ ...rf, amort: x })} step={1} max={40} />
            <Field label="Holding horizon (yrs)" value={rf.horizon} onChange={(x) => setRf({ ...rf, horizon: x })} step={1} max={40} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={clsx("rounded-[var(--radius)] border p-4", refiRes.winner === "A" ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)]" : "border-[hsl(var(--border))]")}>
              <div className="font-bold mb-2">Option A {refiRes.winner === "A" && <span className="text-[hsl(var(--primary))]">✓ cheaper</span>}</div>
              <div className="flex gap-4 mb-3">
                <Field label="Rate (%)" value={rf.aRate} onChange={(x) => setRf({ ...rf, aRate: x })} max={20} />
                <Field label="Points (%)" value={rf.aPoints} onChange={(x) => setRf({ ...rf, aPoints: x })} step={0.5} max={10} />
              </div>
              <div className="text-sm">Effective cost over {rf.horizon} yrs: <b className="font-mono">{pct(refiRes.A.eff)}</b></div>
            </div>
            <div className={clsx("rounded-[var(--radius)] border p-4", refiRes.winner === "B" ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)]" : "border-[hsl(var(--border))]")}>
              <div className="font-bold mb-2">Option B {refiRes.winner === "B" && <span className="text-[hsl(var(--primary))]">✓ cheaper</span>}</div>
              <div className="flex gap-4 mb-3">
                <Field label="Rate (%)" value={rf.bRate} onChange={(x) => setRf({ ...rf, bRate: x })} max={20} />
                <Field label="Points (%)" value={rf.bPoints} onChange={(x) => setRf({ ...rf, bPoints: x })} step={0.5} max={10} />
              </div>
              <div className="text-sm">Effective cost over {rf.horizon} yrs: <b className="font-mono">{pct(refiRes.B.eff)}</b></div>
            </div>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Set the horizon to 5 years, then 15 — watch the cheaper option flip from B (low points) to A (low rate).</p>
        </div>
      )}
    </div>
  );
}
