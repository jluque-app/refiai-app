"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

/**
 * AmortizationLab — Unit 3 interactive lab covering the four repayment patterns
 * (Interest-Only, Constant Payment / CPM, Constant Amortization / CAM, and ARM).
 * In-page version of the CREFI II.2 / II.3 / II.4 / II.5 Excel models. Defaults
 * match the class files: €100,000, 7% nominal annual, 30-year amortization.
 */

type Pattern = "IO" | "CPM" | "CAM" | "ARM";

interface Row {
  mo: number;
  rate: number; // monthly rate used that month
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

const eur = (v: number) =>
  new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const eur2 = (v: number) =>
  new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);

function annuityPayment(balance: number, monthlyRate: number, nMonths: number): number {
  if (nMonths <= 0) return balance;
  if (monthlyRate === 0) return balance / nMonths;
  return (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -nMonths));
}

function buildSchedule(
  pattern: Pattern,
  loan: number,
  ratePct: number,
  termYears: number,
  arm: { initial: number; indexed: number; periodicCap: number; lifetimeCap: number; fixedYears: number }
): Row[] {
  const n = Math.round(termYears * 12);
  const rows: Row[] = [];
  let balance = loan;

  if (pattern === "CAM") {
    const principal = loan / n;
    for (let m = 1; m <= n; m++) {
      const r = ratePct / 100 / 12;
      const interest = balance * r;
      const payment = principal + interest;
      balance = Math.max(balance - principal, 0);
      rows.push({ mo: m, rate: r, payment, interest, principal, balance });
    }
    return rows;
  }

  if (pattern === "IO") {
    const r = ratePct / 100 / 12;
    for (let m = 1; m <= n; m++) {
      const interest = balance * r;
      const principal = m === n ? balance : 0; // balloon repaid at maturity
      const payment = interest + (m === n ? balance : 0);
      balance = m === n ? 0 : balance;
      rows.push({ mo: m, rate: r, payment, interest, principal, balance });
    }
    return rows;
  }

  if (pattern === "CPM") {
    const r = ratePct / 100 / 12;
    const payment = annuityPayment(loan, r, n);
    for (let m = 1; m <= n; m++) {
      const interest = balance * r;
      const principal = payment - interest;
      balance = Math.max(balance - principal, 0);
      rows.push({ mo: m, rate: r, payment, interest, principal, balance });
    }
    return rows;
  }

  // ARM: fixed initial rate, then annual resets toward the fully-indexed rate,
  // limited by the periodic cap and an overall lifetime cap above the start rate.
  let annualRate = arm.initial;
  let monthlyRate = annualRate / 100 / 12;
  let payment = annuityPayment(loan, monthlyRate, n);
  const fixedMonths = Math.round(arm.fixedYears * 12);
  const maxRate = arm.initial + arm.lifetimeCap;
  for (let m = 1; m <= n; m++) {
    // reset at each anniversary after the fixed period
    if (m > fixedMonths && (m - fixedMonths - 1) % 12 === 0) {
      const target = arm.indexed;
      const capped = Math.max(annualRate - arm.periodicCap, Math.min(annualRate + arm.periodicCap, target));
      annualRate = Math.min(capped, maxRate);
      monthlyRate = annualRate / 100 / 12;
      payment = annuityPayment(balance, monthlyRate, n - (m - 1)); // recompute on remaining balance & term
    }
    const interest = balance * monthlyRate;
    const principal = payment - interest;
    balance = Math.max(balance - principal, 0);
    rows.push({ mo: m, rate: monthlyRate, payment, interest, principal, balance });
  }
  return rows;
}

const PATTERN_INFO: Record<Pattern, { label: string; blurb: string }> = {
  IO: { label: "Interest-Only", blurb: "You pay only interest each month; the full principal is due as a balloon at maturity. Lowest payment, zero amortization." },
  CPM: { label: "Constant Payment (CPM)", blurb: "The same total payment every month. Early payments are mostly interest; over time more goes to principal." },
  CAM: { label: "Constant Amortization (CAM)", blurb: "The same principal repaid every month, so the payment falls over time as interest on the shrinking balance declines." },
  ARM: { label: "Adjustable-Rate (ARM)", blurb: "A fixed initial rate, then the rate resets toward the fully-indexed rate (index + margin), limited by periodic and lifetime caps." },
};

export default function AmortizationLab() {
  const [pattern, setPattern] = useState<Pattern>("CPM");
  const [loan, setLoan] = useState(100000);
  const [rate, setRate] = useState(7);
  const [term, setTerm] = useState(30);
  const [arm, setArm] = useState({ initial: 6, indexed: 8, periodicCap: 2, lifetimeCap: 5, fixedYears: 1 });

  const schedule = useMemo(() => buildSchedule(pattern, loan, rate, term, arm), [pattern, loan, rate, term, arm]);

  const totalInterest = schedule.reduce((a, r) => a + r.interest, 0);
  const first = schedule[0];
  const month13 = schedule[12];
  const last = schedule[schedule.length - 1];
  const balloon = pattern === "IO" ? loan : 0;

  const input =
    "w-28 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-2 py-1.5 text-sm font-mono text-[hsl(var(--primary))]";

  return (
    <div className="space-y-5 p-1">
      <div>
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2">🧮 Amortization Patterns Lab</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          The four ways a mortgage repays — in one place. Pick a pattern and edit the inputs; the schedule and payment
          behaviour recompute live. Defaults match the class files (€100,000, 7%, 30&nbsp;years).
        </p>
      </div>

      {/* Pattern selector */}
      <div className="flex flex-wrap gap-2">
        {(["IO", "CPM", "CAM", "ARM"] as Pattern[]).map((p) => (
          <button
            key={p}
            onClick={() => setPattern(p)}
            className={clsx(
              "px-3 py-2 rounded-lg text-sm font-semibold border transition-colors",
              pattern === p
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-transparent"
                : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))]"
            )}
          >
            {PATTERN_INFO[p].label}
          </button>
        ))}
      </div>

      <p className="text-sm text-[hsl(var(--foreground))] bg-[hsl(var(--muted)/0.3)] border-l-2 border-[hsl(var(--primary))] rounded-r px-3 py-2">
        {PATTERN_INFO[pattern].blurb}
      </p>

      {/* Inputs */}
      <div className="flex flex-wrap gap-5 bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4">
        <label className="text-sm">
          <span className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">Loan amount</span>
          <input type="number" min={0} step={10000} value={loan} onChange={(e) => setLoan(Math.max(0, Number(e.target.value)))} className={input} />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">{pattern === "ARM" ? "(rate set below)" : "Annual rate (%)"}</span>
          <input type="number" min={0} max={20} step={0.1} value={rate} disabled={pattern === "ARM"} onChange={(e) => setRate(Math.max(0, Number(e.target.value)))} className={clsx(input, pattern === "ARM" && "opacity-40")} />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">Amortization (yrs)</span>
          <input type="number" min={1} max={40} step={1} value={term} onChange={(e) => setTerm(Math.max(1, Number(e.target.value)))} className={input} />
        </label>
        {pattern === "ARM" && (
          <>
            <label className="text-sm">
              <span className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">Initial rate (%)</span>
              <input type="number" min={0} max={20} step={0.1} value={arm.initial} onChange={(e) => setArm({ ...arm, initial: Number(e.target.value) })} className={input} />
            </label>
            <label className="text-sm">
              <span className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">Fully-indexed (index+margin, %)</span>
              <input type="number" min={0} max={20} step={0.1} value={arm.indexed} onChange={(e) => setArm({ ...arm, indexed: Number(e.target.value) })} className={input} />
            </label>
            <label className="text-sm">
              <span className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">Fixed period (yrs)</span>
              <input type="number" min={0} max={10} step={1} value={arm.fixedYears} onChange={(e) => setArm({ ...arm, fixedYears: Number(e.target.value) })} className={input} />
            </label>
            <label className="text-sm">
              <span className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">Annual cap (%)</span>
              <input type="number" min={0} max={10} step={0.5} value={arm.periodicCap} onChange={(e) => setArm({ ...arm, periodicCap: Number(e.target.value) })} className={input} />
            </label>
            <label className="text-sm">
              <span className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">Lifetime cap (+%)</span>
              <input type="number" min={0} max={10} step={0.5} value={arm.lifetimeCap} onChange={(e) => setArm({ ...arm, lifetimeCap: Number(e.target.value) })} className={input} />
            </label>
          </>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="First payment" value={eur2(first?.payment ?? 0)} sub="month 1" />
        <Kpi
          label={pattern === "CAM" ? "Payment trend" : pattern === "ARM" ? "After first reset" : "Payment (level)"}
          value={pattern === "CPM" || pattern === "IO" ? eur2(first?.payment ?? 0) : eur2(month13?.payment ?? first?.payment ?? 0)}
          sub={pattern === "CAM" ? "falls each month" : pattern === "ARM" ? "month 13" : "every month"}
        />
        <Kpi label="Total interest" value={eur(totalInterest)} sub="over the life" />
        <Kpi label="Balloon at maturity" value={eur(balloon)} sub={pattern === "IO" ? "principal due" : "fully amortized"} tone={pattern === "IO" ? "amber" : "muted"} />
      </div>

      {/* First-year schedule */}
      <div className="overflow-x-auto border border-[hsl(var(--border))] rounded-[var(--radius)]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[hsl(var(--muted)/0.5)] text-[hsl(var(--muted-foreground))]">
              <th className="text-left px-3 py-2 font-semibold">Month</th>
              {pattern === "ARM" && <th className="px-3 py-2 font-semibold text-right">Rate</th>}
              <th className="px-3 py-2 font-semibold text-right">Payment</th>
              <th className="px-3 py-2 font-semibold text-right">Interest</th>
              <th className="px-3 py-2 font-semibold text-right">Principal</th>
              <th className="px-3 py-2 font-semibold text-right">Ending balance</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {schedule.slice(0, 12).map((r) => (
              <tr key={r.mo} className="border-t border-[hsl(var(--border))]">
                <td className="px-3 py-1.5 text-left">{r.mo}</td>
                {pattern === "ARM" && <td className="px-3 py-1.5 text-right">{(r.rate * 12 * 100).toFixed(2)}%</td>}
                <td className="px-3 py-1.5 text-right">{eur2(r.payment)}</td>
                <td className="px-3 py-1.5 text-right text-[hsl(var(--muted-foreground))]">{eur2(r.interest)}</td>
                <td className="px-3 py-1.5 text-right">{eur2(r.principal)}</td>
                <td className="px-3 py-1.5 text-right">{eur(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        Showing the first 12 months. End-of-term balance: {eur(last?.balance ?? 0)}. Notice how the interest/principal
        split (and, for ARM, the rate) evolves.
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, tone = "primary" }: { label: string; value: string; sub: string; tone?: "primary" | "amber" | "muted" }) {
  const color = tone === "amber" ? "text-amber-500" : tone === "muted" ? "text-[hsl(var(--muted-foreground))]" : "text-[hsl(var(--primary))]";
  return (
    <div className="bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-bold">{label}</div>
      <div className={clsx("text-lg font-extrabold font-mono mt-1", color)}>{value}</div>
      <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</div>
    </div>
  );
}
