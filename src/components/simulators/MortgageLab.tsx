"use client";

import { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, AreaChart, Area } from "recharts";
import clsx from "clsx";

// --- Types & Helpers ---
const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);
};

const formatPercent = (val: number) => `${val.toFixed(2)}%`;

const annuityPayment = (principal: number, rate: number, years: number) => {
    if (rate <= 0) return principal / years;
    const n = years; // Assuming annual for simplicity based on Python code
    return principal * (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
};

export default function MortgageLabSimulator() {
    const [activeTab, setActiveTab] = useState<"CPM" | "IO" | "CA" | "ARM">("CPM");

    // Global Inputs
    const [loanAmt, setLoanAmt] = useState(5000000);
    const [years, setYears] = useState(10);
    const [rate, setRate] = useState(5.0); // %

    // Specific Inputs
    // ARM
    const [armResetYears, setArmResetYears] = useState(1);
    const [armAnnualCap, setArmAnnualCap] = useState(2.0); // %
    const [armLifeCap, setArmLifeCap] = useState(5.0); // %

    const updateRate = (val: number) => setRate(val);

    const results = useMemo(() => {
        const r = rate / 100;
        const n = years;
        const data = [];

        if (activeTab === "CPM") {
            const pmt = annuityPayment(loanAmt, r, n);
            let bal = loanAmt;
            for (let t = 1; t <= n; t++) {
                const interest = bal * r;
                const principal = pmt - interest;
                bal = Math.max(0, bal - principal);
                data.push({ year: t, interest, principal, balance: bal, payment: pmt });
            }
        } else if (activeTab === "IO") {
            const interestPmt = loanAmt * r;
            for (let t = 1; t <= n; t++) {
                let principal = 0;
                let pmt = interestPmt;
                let bal = loanAmt;
                if (t === n) {
                    principal = loanAmt;
                    pmt += principal;
                    bal = 0;
                }
                data.push({ year: t, interest: interestPmt, principal, balance: bal, payment: pmt });
            }
        } else if (activeTab === "CA") {
            const principalPmt = loanAmt / n;
            let bal = loanAmt;
            for (let t = 1; t <= n; t++) {
                const interest = bal * r;
                const pmt = interest + principalPmt;
                bal = Math.max(0, bal - principalPmt);
                data.push({ year: t, interest, principal: principalPmt, balance: bal, payment: pmt });
            }
        } else if (activeTab === "ARM") {
            // Simplified ARM: Assumes rate raises by 0.5% every reset period until capped? Or just random? 
            // The python code allowed manual entry or a list. Let's sim a defined stress scenario: +1% every reset year.
            let bal = loanAmt;
            let currentRate = r;
            const startRate = r;
            let nextReset = armResetYears;

            for (let t = 1; t <= n; t++) {
                // Check reset
                if (t > 1 && (t - 1) % armResetYears === 0) {
                    // increase rate by 1% for demo, capped
                    // respect annual cap
                    const proposed = currentRate + 0.01;
                    const maxAnnual = currentRate + (armAnnualCap / 100);
                    const maxLife = startRate + (armLifeCap / 100);

                    currentRate = Math.min(proposed, maxAnnual, maxLife);
                }

                // Recalculate PMT based on remaining Principal and Term
                const remainingYears = n - t + 1;
                const pmt = annuityPayment(bal, currentRate, remainingYears);
                const interest = bal * currentRate;
                const principal = pmt - interest;
                bal = Math.max(0, bal - principal);
                data.push({ year: t, interest, principal, balance: bal, payment: pmt, rate: currentRate * 100 });
            }
        }

        return data;
    }, [activeTab, loanAmt, years, rate, armResetYears, armAnnualCap, armLifeCap]);

    return (
        <div className="space-y-8 p-1">
            <div className="bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            🏢 Mortgage Lab
                        </h2>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Compare different amortization structures and see their impact on payments and balance.
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-[hsl(var(--muted))] p-1 rounded-lg">
                        {(["CPM", "IO", "CA", "ARM"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={clsx(
                                    "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                                    activeTab === tab
                                        ? "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] shadow-sm"
                                        : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Loan Amount (€)</label>
                            <input
                                type="number"
                                value={loanAmt}
                                onChange={(e) => setLoanAmt(Number(e.target.value))}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Term (Years)</label>
                            <input
                                type="number"
                                value={years}
                                onChange={(e) => setYears(Number(e.target.value))}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Initial Rate (%)</label>
                            <input
                                type="range" min="0" max="15" step="0.1"
                                value={rate}
                                onChange={(e) => setRate(Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{rate.toFixed(2)}%</div>
                        </div>
                        {activeTab === "ARM" && (
                            <div className="pt-2 border-t border-[hsl(var(--border))]">
                                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Reset Every (Years)</label>
                                <input
                                    type="number"
                                    value={armResetYears}
                                    onChange={(e) => setArmResetYears(Number(e.target.value))}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                                />
                            </div>
                        )}
                    </div>

                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] p-4 rounded-lg flex flex-col justify-center">
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">First Year Payment</div>
                        <div className="text-2xl font-bold text-[hsl(var(--primary))]">
                            {formatCurrency(results[0]?.payment || 0)}
                        </div>
                        <div className="text-xs mt-1 text-[hsl(var(--muted-foreground))]">
                            Total Interest (Life): <span className="text-[hsl(var(--foreground))]">{formatCurrency(results.reduce((a, b) => a + b.interest, 0))}</span>
                        </div>
                        {activeTab === 'IO' && <div className="text-xs text-red-400 mt-1">Balloon Due: {formatCurrency(loanAmt)}</div>}
                    </div>
                </div>
            </div>

            <div className="h-[400px] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4 bg-[hsl(var(--surface))]">
                <h3 className="text-sm font-bold mb-4">Payment Composition Over Time</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={results}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="year" />
                        <YAxis tickFormatter={(val) => `€${val / 1000}k`} />
                        <Tooltip
                            formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''}
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="interest" stackId="1" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" name="Interest" opacity={0.8} />
                        <Area type="monotone" dataKey="principal" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" name="Principal" opacity={0.8} />
                        {/* Balance as a line on top? Complex with stacked. Let's just keep stack */}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Secondary Balance Chart */}
            <div className="h-[250px] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4 bg-[hsl(var(--surface))]">
                <h3 className="text-sm font-bold mb-4">Outstanding Balance</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={results}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="year" />
                        <YAxis tickFormatter={(val) => `€${val / 1000000}m`} />
                        <Tooltip
                            formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''}
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))' }}
                        />
                        <Line type="monotone" dataKey="balance" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} name="Loan Balance" />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
