"use client";

import { useState } from "react";
import clsx from "clsx";

/**
 * MortgageBalloonLab — an embedded, interactive spreadsheet for Unit 3
 * ("Note vs. Mortgage & Loan Mechanics"). Students change the blue inputs
 * (loan, rate, amortization & payoff years) and the monthly payment and the
 * balloon recompute live — the in-page version of the class Excel, so nobody
 * has to leave the platform. Same finance math as the .xlsx (=PMT / =FV).
 */

interface Scenario {
  id: number;
  name: string;
  amortYears: number;
  payoffYears: number;
}

const BASE: { loan: number; rate: number; scenarios: Scenario[] } = {
  loan: 2_000_000,
  rate: 8, // % annual
  scenarios: [
    { id: 1, name: "Fully amortizing (25-yr)", amortYears: 25, payoffYears: 25 },
    { id: 2, name: "25-yr amortization, 10-yr balloon", amortYears: 25, payoffYears: 10 },
    { id: 3, name: "15-yr amortization, 10-yr balloon", amortYears: 15, payoffYears: 10 },
  ],
};

const eur = (v: number) =>
  new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

function monthlyPayment(loan: number, annualRate: number, amortYears: number): number {
  const r = annualRate / 100 / 12;
  const n = Math.round(amortYears * 12);
  if (n <= 0) return 0;
  if (r === 0) return loan / n;
  return (loan * r) / (1 - Math.pow(1 + r, -n));
}

function balloon(loan: number, annualRate: number, amortYears: number, payoffYears: number): number {
  const r = annualRate / 100 / 12;
  const pay = monthlyPayment(loan, annualRate, amortYears);
  const k = Math.round(payoffYears * 12);
  if (r === 0) return Math.max(loan - pay * k, 0);
  const f = Math.pow(1 + r, k);
  return Math.max(loan * f - pay * ((f - 1) / r), 0);
}

export default function MortgageBalloonLab() {
  const [loan, setLoan] = useState(BASE.loan);
  const [rate, setRate] = useState(BASE.rate);
  const [scenarios, setScenarios] = useState<Scenario[]>(BASE.scenarios.map((s) => ({ ...s })));

  const reset = () => {
    setLoan(BASE.loan);
    setRate(BASE.rate);
    setScenarios(BASE.scenarios.map((s) => ({ ...s })));
  };

  const update = (id: number, key: "amortYears" | "payoffYears", value: number) =>
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, [key]: value } : s)));

  const numCell =
    "w-20 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-2 py-1 text-sm text-center font-mono text-[hsl(var(--primary))]";

  return (
    <div className="space-y-5 p-1">
      <div>
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2">🧮 Mortgage Payment &amp; Balloon — live sheet</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Edit the blue cells and watch the payment and balloon recompute — no download needed. This is the in-page
          version of the class Excel.
        </p>
      </div>

      {/* Shared inputs */}
      <div className="flex flex-wrap gap-6 bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4">
        <label className="text-sm">
          <span className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">Loan amount (PV)</span>
          <input
            type="number"
            value={loan}
            min={0}
            step={50000}
            onChange={(e) => setLoan(Math.max(0, Number(e.target.value)))}
            className="w-40 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm font-mono text-[hsl(var(--primary))]"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1">Annual interest rate (%)</span>
          <input
            type="number"
            value={rate}
            min={0}
            max={20}
            step={0.1}
            onChange={(e) => setRate(Math.max(0, Number(e.target.value)))}
            className="w-28 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm font-mono text-[hsl(var(--primary))]"
          />
        </label>
        <div className="flex items-end">
          <button
            onClick={reset}
            className="text-xs font-bold border border-[hsl(var(--border))] rounded px-3 py-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:border-[hsl(var(--primary))] transition-colors"
          >
            ↺ Reset to example
          </button>
        </div>
      </div>

      {/* The sheet */}
      <div className="overflow-x-auto border border-[hsl(var(--border))] rounded-[var(--radius)]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[hsl(var(--muted)/0.5)]">
              <th className="text-left px-3 py-2 font-semibold">Scenario</th>
              <th className="px-3 py-2 font-semibold text-center">Amortization (yrs)</th>
              <th className="px-3 py-2 font-semibold text-center">Payoff (yrs)</th>
              <th className="px-3 py-2 font-semibold text-right">Monthly payment</th>
              <th className="px-3 py-2 font-semibold text-right">Balloon (OLB at payoff)</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => {
              const pay = monthlyPayment(loan, rate, s.amortYears);
              const bal = balloon(loan, rate, s.amortYears, s.payoffYears);
              const fullyAmortized = s.payoffYears >= s.amortYears;
              return (
                <tr key={s.id} className="border-t border-[hsl(var(--border))]">
                  <td className="px-3 py-2 text-[hsl(var(--foreground))]">{s.name}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={s.amortYears}
                      onChange={(e) => update(s.id, "amortYears", Math.max(1, Number(e.target.value)))}
                      className={numCell}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min={1}
                      max={s.amortYears}
                      value={s.payoffYears}
                      onChange={(e) => update(s.id, "payoffYears", Math.max(1, Number(e.target.value)))}
                      className={numCell}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{eur(pay)}/mo</td>
                  <td className={clsx("px-3 py-2 text-right font-mono font-semibold", fullyAmortized ? "text-[hsl(var(--muted-foreground))]" : "text-[hsl(var(--foreground))]")}>
                    {fullyAmortized ? eur(0) : eur(bal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed space-y-1">
        <p>
          <b>Monthly payment</b> = <span className="font-mono">PMT(rate/12, amortization×12, −loan)</span> — the level
          annuity that fully repays the loan over the amortization period.
        </p>
        <p>
          <b>Balloon</b> = <span className="font-mono">FV(rate/12, payoff×12, payment, −loan)</span> — the balance still
          owed at the payoff date. When payoff = amortization, the balloon is €0.
        </p>
        <p>Try it: shorten the amortization and the payment rises but the balloon shrinks — less refinancing risk.</p>
      </div>
    </div>
  );
}
