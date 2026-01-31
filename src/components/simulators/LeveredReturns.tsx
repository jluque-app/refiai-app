"use client";

import { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar } from "recharts";
import clsx from "clsx";

// --- Types ---
interface Inputs {
    purchasePrice: number;
    years: number;
    pgi: number;
    vacancyRate: number;
    growthRate: number;
    opexRatio: number;
    capexRatio: number;
    terminalCapRate: number;
    saleCost: number;
    ltv: number;
    interestRate: number;
    amortYears: number;
    loanFee: number;
    prepayPenalty: number;
}

// --- Helpers ---
const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);
};

const formatPercent = (val: number) => `${val.toFixed(2)}%`;

const calculateIRR = (cashFlows: number[], guess = 0.1): number => {
    const maxIter = 1000;
    const precision = 1e-7;
    let rate = guess;

    for (let i = 0; i < maxIter; i++) {
        let npv = 0;
        let dNpv = 0;
        for (let t = 0; t < cashFlows.length; t++) {
            const cf = cashFlows[t];
            const div = Math.pow(1 + rate, t);
            npv += cf / div;
            dNpv -= (t * cf) / (div * (1 + rate));
        }

        if (Math.abs(dNpv) < precision) break;
        const newRate = rate - npv / dNpv;
        if (Math.abs(newRate - rate) < precision) return newRate;
        rate = newRate;
    }
    return rate;
};

export default function LeveredReturnsSimulator() {
    const [inputs, setInputs] = useState<Inputs>({
        purchasePrice: 10000000,
        years: 10,
        pgi: 1200000,
        vacancyRate: 5.0,
        growthRate: 2.0,
        opexRatio: 35.0,
        capexRatio: 5.0,
        terminalCapRate: 6.5,
        saleCost: 2.0,
        ltv: 60.0,
        interestRate: 5.0,
        amortYears: 25,
        loanFee: 1.0,
        prepayPenalty: 0.0,
    });

    const updateInput = (key: keyof Inputs, val: number) => {
        setInputs((prev) => ({ ...prev, [key]: val }));
    };

    const results = useMemo(() => {
        const {
            purchasePrice, years, pgi, vacancyRate, growthRate, opexRatio, capexRatio,
            terminalCapRate, saleCost, ltv, interestRate, amortYears, loanFee, prepayPenalty
        } = inputs;

        // Rates
        const g = growthRate / 100;
        const vac = vacancyRate / 100;
        const opex = opexRatio / 100;
        const capex = capexRatio / 100;
        const tCap = terminalCapRate / 100;
        const sCost = saleCost / 100;
        const r = interestRate / 100;
        const lf = loanFee / 100;
        const pp = prepayPenalty / 100;

        // --- Operating Pro Forma (Unlevered) ---
        const proforma = [];
        let currentPgi = pgi;

        for (let t = 1; t <= years; t++) {
            const potentialGrossIncome = t === 1 ? pgi : currentPgi * (1 + g);
            if (t > 1) currentPgi = potentialGrossIncome;

            const vacancyLoss = -vac * potentialGrossIncome;
            const egi = potentialGrossIncome + vacancyLoss;
            const operatingExpenses = -opex * egi;
            const noi = egi + operatingExpenses;
            const capitalImprovements = -capex * noi;
            const pbtcf = noi + capitalImprovements;

            proforma.push({
                year: t,
                pgi: potentialGrossIncome,
                pbtcf
            });
        }

        const lastNoi = proforma[years - 1].pbtcf / (1 - capexRatio / 100) * (1 - opexRatio / 100); // Approximation to back out NOI if needed, but better to store it.
        // Actually lets just grab NOI from the loop properly?
        // Let's re-calculate cleanly inside loop or just use the last calculated values from logic.
        // Re-doing the last year NOI for terminal value:
        const finalPgi = pgi * Math.pow(1 + g, years - 1);
        const finalEgi = finalPgi * (1 - vac);
        const finalNoi = finalEgi * (1 - opex);
        const nextNoi = finalNoi * (1 + g);

        const terminalValue = nextNoi / tCap;
        const nsp = terminalValue * (1 - sCost);

        // --- Debt Schedule ---
        const loanAmt = (ltv / 100) * purchasePrice;
        const netProceeds = loanAmt * (1 - lf);

        // Annual Payment (PMT)
        const n = amortYears;
        let payment = 0;
        if (r > 0) {
            payment = loanAmt * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        } else {
            payment = loanAmt / n;
        }

        // Amortization loop to find balance at year N
        let balance = loanAmt;
        for (let t = 1; t <= years; t++) {
            const interest = balance * r;
            const principal = payment - interest;
            balance = balance - principal;
            if (balance < 0) balance = 0;
        }
        const payoffAtSale = balance;
        const penaltyAmt = payoffAtSale * pp;

        // --- Cash Flows ---
        const unleveredCf = [-purchasePrice];
        const leveredCf = [-(purchasePrice - netProceeds)];

        proforma.forEach((row, i) => {
            // Unlevered
            let uCf = row.pbtcf;
            if (i === years - 1) uCf += nsp;
            unleveredCf.push(uCf);

            // Levered
            // Debt service is constant 'payment' unless loan is paid off, but we assume term <= amort usually or we handle handle simpler
            // Python code logic: "Debt service vector (annual payment)"
            // Logic check: if years > amortYears, payment stops? 
            // The python code: `debt_service = sched["Payment"].reindex(range(1, int(years) + 1)).fillna(0.0).values`
            // Let's replicate strict logic:
            let ds = 0;
            // Check if year 't' is within amort schedule
            if (row.year <= amortYears) {
                ds = payment;
            }

            let lCf = row.pbtcf - ds;
            if (i === years - 1) {
                lCf += (nsp - payoffAtSale - penaltyAmt);
            }
            leveredCf.push(lCf);
        });

        const unleveredIrr = calculateIRR(unleveredCf);
        const leveredIrr = calculateIRR(leveredCf);

        const totalEquityIn = purchasePrice - netProceeds;
        const totalEquityOut = leveredCf.slice(1).reduce((a, b) => a + b, 0);
        // Equity multiple is sum of positive inflows / sum of negative outflows usually? 
        // Python: `equity_multiple = (np.sum(eq_cf[1:])) / max(-eq_cf[0], 1e-12)` (simplified assumption that only CF[0] is negative)
        const equityMultiple = totalEquityOut / (totalEquityIn || 1);

        // Chart Data
        const chartData = proforma.map((row, i) => ({
            year: row.year,
            Unlevered: unleveredCf[i + 1],
            Levered: leveredCf[i + 1]
        }));

        return {
            unleveredIrr,
            leveredIrr,
            equityMultiple,
            loanAmt,
            netProceeds,
            payoffAtSale,
            nsp,
            chartData
        };

    }, [inputs]);

    return (
        <div className="space-y-8 p-1">
            <div className="bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    📈 Levered Returns Simulator
                </h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
                    See how debt financing (leverage) impacts your returns. Compare Unlevered vs. Levered interactions.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* 1. Acquisition & Time */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-xs uppercase tracking-wider text-[hsl(var(--primary))]">Acquisition</h4>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Purchase Price (€)</label>
                            <input
                                type="number"
                                value={inputs.purchasePrice}
                                onChange={(e) => updateInput('purchasePrice', Number(e.target.value))}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Holding Period (Years)</label>
                            <input
                                type="number"
                                value={inputs.years}
                                onChange={(e) => updateInput('years', Number(e.target.value))}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">LTV (%)</label>
                            <input
                                type="range" min="0" max="90" step="1"
                                value={inputs.ltv}
                                onChange={(e) => updateInput('ltv', Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{inputs.ltv}%</div>
                        </div>
                    </div>

                    {/* 2. Operations */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-xs uppercase tracking-wider text-[hsl(var(--primary))]">Operations</h4>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">PGI (Year 1)</label>
                            <input
                                type="number"
                                value={inputs.pgi}
                                onChange={(e) => updateInput('pgi', Number(e.target.value))}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Growth Rate (%)</label>
                            <input
                                type="range" min="0" max="10" step="0.1"
                                value={inputs.growthRate}
                                onChange={(e) => updateInput('growthRate', Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{inputs.growthRate}%</div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Opex %</label>
                            <input
                                type="range" min="10" max="60" step="1"
                                value={inputs.opexRatio}
                                onChange={(e) => updateInput('opexRatio', Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{inputs.opexRatio}%</div>
                        </div>
                    </div>

                    {/* 3. Debt */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-xs uppercase tracking-wider text-[hsl(var(--primary))]">Financing</h4>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Interest Rate (%)</label>
                            <input
                                type="range" min="1" max="15" step="0.1"
                                value={inputs.interestRate}
                                onChange={(e) => updateInput('interestRate', Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{inputs.interestRate}%</div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Amortization (Years)</label>
                            <input
                                type="number"
                                value={inputs.amortYears}
                                onChange={(e) => updateInput('amortYears', Number(e.target.value))}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Loan Fee (%)</label>
                            <input
                                type="number" step="0.1"
                                value={inputs.loanFee}
                                onChange={(e) => updateInput('loanFee', Number(e.target.value))}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    {/* 4. Exit */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-xs uppercase tracking-wider text-[hsl(var(--primary))]">Exit</h4>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Terminal Cap (%)</label>
                            <input
                                type="range" min="2" max="12" step="0.1"
                                value={inputs.terminalCapRate}
                                onChange={(e) => updateInput('terminalCapRate', Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{inputs.terminalCapRate}%</div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Sale Cost (%)</label>
                            <input
                                type="number" step="0.1"
                                value={inputs.saleCost}
                                onChange={(e) => updateInput('saleCost', Number(e.target.value))}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="col-span-1 lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] p-4 rounded-lg">
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">Unlevered IRR</div>
                        <div className="text-3xl font-bold text-[hsl(var(--secondary))]">
                            {formatPercent(results.unleveredIrr * 100)}
                        </div>
                        <div className="text-xs mt-1">Property Level Return</div>
                    </div>
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] p-4 rounded-lg">
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">Levered IRR</div>
                        <div className="text-3xl font-bold text-[hsl(var(--primary))]">
                            {formatPercent(results.leveredIrr * 100)}
                        </div>
                        <div className="text-xs mt-1">Equity Return w/ {inputs.ltv}% Debt</div>
                    </div>
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] p-4 rounded-lg">
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">Equity Multiple</div>
                        <div className="text-3xl font-bold">
                            {results.equityMultiple.toFixed(2)}x
                        </div>
                        <div className="text-xs mt-1">Total Cash Returned / Equity Invested</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart */}
                <div className="h-[350px] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4 bg-[hsl(var(--surface))]">
                    <h3 className="text-sm font-bold mb-4">Cash Flow Comparison</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={results.chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis dataKey="year" />
                            <YAxis tickFormatter={(val) => `€${val / 1000}k`} />
                            <Tooltip
                                formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''}
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                            />
                            <Legend />
                            <Bar dataKey="Unlevered" fill="hsl(var(--secondary))" opacity={0.7} name="Unlevered CF" />
                            <Bar dataKey="Levered" fill="hsl(var(--primary))" name="Levered CF" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Details Tableish */}
                <div className="border border-[hsl(var(--border))] rounded-[var(--radius)] p-4 bg-[hsl(var(--surface))] text-sm space-y-3">
                    <h3 className="font-bold mb-2">Deal Summary</h3>
                    <div className="flex justify-between py-2 border-b border-[hsl(var(--border))]">
                        <span>Gross Purchase Price</span>
                        <span>{formatCurrency(inputs.purchasePrice)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[hsl(var(--border))]">
                        <span>Loan Amount</span>
                        <span>{formatCurrency(results.loanAmt)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[hsl(var(--border))]">
                        <span>Initial Equity Required</span>
                        <span className="font-semibold text-[hsl(var(--primary))]">{formatCurrency(inputs.purchasePrice - results.netProceeds)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[hsl(var(--border))]">
                        <span>Net Sale Price (Year {inputs.years})</span>
                        <span>{formatCurrency(results.nsp)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[hsl(var(--border))]">
                        <span>Loan Payoff at Sale</span>
                        <span className="text-red-400">-{formatCurrency(results.payoffAtSale)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
