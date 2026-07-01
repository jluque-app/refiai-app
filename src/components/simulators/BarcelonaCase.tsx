"use client";

import { useState, useMemo } from "react";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid
} from "recharts";
import { Info } from "lucide-react";

// --- Constants ---

// Hardcoded from python script
const ROOMS_NET_REV = [
    4089939.11, 4476231.98, 4775812.79, 4946595.25, 5137454.32,
    5345913.16, 5424501.42, 5742044.21, 5871041.35, 6143894.10
];
const TOTAL_LEASE_PROPOSED = [
    1769712.98, 1930965.77, 2025333.48, 2107962.37, 2157483.55,
    2254955.59, 2310092.16, 2427888.77, 2548832.16, 2567462.02
];

// --- Helpers ---

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-EU', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

const formatPercent = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(val);

function pmt(rate_m: number, n_months: number, pv: number): number {
    if (Math.abs(rate_m) < 1e-12) return -(pv / n_months);
    return -(pv * rate_m) / (1 - Math.pow(1 + rate_m, -n_months));
}

function fv(rate_m: number, n_months: number, pmtVal: number, pv: number): number {
    return -(pv * Math.pow(1 + rate_m, n_months) + pmtVal * (Math.pow(1 + rate_m, n_months) - 1) / rate_m);
}

function calculateIRR(cashFlows: number[], guess = 0.1): number {
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
}

export default function BarcelonaCaseSimulator() {
    // --- State ---
    const [inputs, setInputs] = useState({
        // Inputs
        purchasePrice: 15000000.0,
        units: 65,
        gca: 4600.0,
        costSqm: 2543.0,
        ffe: 613200.0,
        ffeOpShare: 0.30,

        // Ops
        mgrMonth: 1850.0,
        leaseShare: 0.43,
        exitCap: 0.055,

        // Timeline
        acqYear: 2024,
        licMonths: 12,
        constMonths: 24,
        opsYearsBeforeSale: 5, // Default N_ops

        // Debt
        acqRate: 0.065,
        acqLtc: 0.40,
        acqAmort: 15,

        constRate: 0.065,
        constLtc: 0.90,
        constAmort: 13,

        includeFfeInCons: true,

        // Equity
        cpShare: 0.90,
        opShare: 0.10,

        cpOpsSplit: 0.75,
        opOpsSplit: 0.25,

        cpSaleSplit: 0.75,
        opSaleSplit: 0.25,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setInputs(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : parseFloat(value)
        }));
    };

    // --- Calculations ---
    const results = useMemo(() => {
        const {
            purchasePrice, units, gca, costSqm, ffe, ffeOpShare,
            mgrMonth, leaseShare, exitCap,
            acqYear, licMonths, constMonths, opsYearsBeforeSale,
            acqRate, acqLtc, acqAmort,
            constRate, constLtc, constAmort, includeFfeInCons,
            cpShare, opShare, cpOpsSplit, opOpsSplit, cpSaleSplit, opSaleSplit
        } = inputs;

        const totalDevMonths = licMonths + constMonths;
        // Ops start: Acq Year + ceil(devMonths/12)?
        // Python: ops_start_year = acquisition_year + (total_dev_months + 11) // 12
        const opsStartYear = acqYear + Math.floor((totalDevMonths + 11) / 12);
        const saleYear = opsStartYear + opsYearsBeforeSale;

        // Costs
        const constCost = costSqm * gca;
        const ffeOp = ffe * ffeOpShare;
        const ffeInvestor = ffe - ffeOp;
        const consBase = constCost + (includeFfeInCons ? ffe : 0); // Python: const_cost + (ffe if include... else 0)
        // Wait, python said: cons_base = const_cost + (ffe if include_ffe_in_cons else 0.0)
        // If include_ffe is true, base uses total FFE?
        // But ffeInvestor is ffe - ffeOp. Investor pays their share?
        // Let's assume Cons Loan covers Total Cost if flag logic matches python.

        const acqLoan = acqLtc * purchasePrice;
        const consLoan = constLtc * consBase;
        const equity0 = purchasePrice - acqLoan;

        // Loan Schedules
        const payYearsAcq = Math.max(0, saleYear - acqYear);
        const payYearsCons = Math.max(0, saleYear - (acqYear + 1)); // Simplified assumption from python

        const calcLoan = (amt: number, r: number, amort: number, payYrs: number) => {
            const rm = r / 12.0;
            const nmo = amort * 12;
            const pmtVal = pmt(rm, nmo, amt);
            const ann = -pmtVal * 12;
            // OLB at PayYrs
            const olb = fv(rm, payYrs * 12, pmtVal, amt);
            return { ann, olb };
        };

        const acqSched = calcLoan(acqLoan, acqRate, acqAmort, payYearsAcq);
        const consSched = calcLoan(consLoan, constRate, constAmort, payYearsCons);

        // Distributions (Annual)
        const cpCf = [-equity0 * cpShare];
        const opCf = [-equity0 * opShare];

        const yearsRange = [];
        for (let y = acqYear + 1; y < saleYear; y++) {
            yearsRange.push(y);
            // Cash Flow per year
            let eqOpsCash = 0;
            if (y >= opsStartYear) {
                // Determine Lease In
                const opsIdx = y - opsStartYear; // 0-indexed
                const revenue = ROOMS_NET_REV[Math.min(opsIdx, 9)]; // Cap at 10 years data
                // Rule: Max of (revenue * share) or (mgr * units * 12)
                const mgrFloor = mgrMonth * units * 12;
                const leaseVal = Math.max(revenue * leaseShare, mgrFloor);

                // Debt Service
                const dsAcq = acqSched.ann;
                const dsCons = consSched.ann;

                eqOpsCash = leaseVal - dsAcq - dsCons;
            }

            cpCf.push(eqOpsCash * cpOpsSplit);
            opCf.push(eqOpsCash * opOpsSplit);
        }

        // Sale Year
        const nextOpsIdx = saleYear - opsStartYear;
        const nextRevenue = ROOMS_NET_REV[Math.min(nextOpsIdx, 9)] ||
            (ROOMS_NET_REV[9] * Math.pow(1.035, nextOpsIdx - 9)); // Fallback growth 3.5% assumption
        const nextLease = Math.max(nextRevenue * leaseShare, mgrMonth * units * 12);
        const salePrice = nextLease / exitCap;

        const seniorPayoff = acqSched.olb + consSched.olb;
        const netSale = salePrice - seniorPayoff; // Assuming no mezz for simplicity in this port

        cpCf.push(netSale * cpSaleSplit);
        opCf.push(netSale * opSaleSplit);

        const irrCp = calculateIRR(cpCf);
        const irrOp = calculateIRR(opCf);
        const totalCf = cpCf.map((c, i) => c + opCf[i]);
        const irrTotal = calculateIRR(totalCf);

        // Chart Data
        const chartData = yearsRange.map((y, i) => ({
            year: y,
            cp: cpCf[i + 1],
            op: opCf[i + 1]
        }));
        // Add Sale Year to chart? It might distort scale. Let's exclude for now or show separate.

        return {
            purchasePrice,
            acqLoan,
            consLoan,
            equity0,
            salePrice,
            netSale,
            irrCp,
            irrOp,
            irrTotal,
            chartData,
            yearsRange
        };

    }, [inputs]);

    return (
        <div className="space-y-8 p-1">
            <div className="bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-6">
                <h2 className="text-xl font-bold mb-2">Barcelona Value-Add Case</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    Buy-Rehab-Lease-Exit strategy. Replicates the Barcelona case study module.
                </p>
                <div className="mt-4 flex gap-6 text-sm">
                    <div>
                        <span className="text-[hsl(var(--muted-foreground))]">Purchase Price: </span>
                        <span className="font-bold">{formatCurrency(inputs.purchasePrice)}</span>
                    </div>
                    <div>
                        <span className="text-[hsl(var(--muted-foreground))]">Total Equity: </span>
                        <span className="font-bold">{formatCurrency(results.equity0)}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Inputs */}
                <div className="lg:col-span-1 space-y-6 bg-[hsl(var(--surface))] p-6 rounded-[var(--radius)] border border-[hsl(var(--border))] h-fit max-h-[800px] overflow-y-auto">
                    <h3 className="font-bold mb-4 text-sm uppercase text-[hsl(var(--primary))]">Assumptions</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Purchase Price (€)</label>
                            <input
                                type="number" name="purchasePrice" value={inputs.purchasePrice} onChange={handleChange}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Units</label>
                            <input
                                type="number" name="units" value={inputs.units} onChange={handleChange}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Acq Loan Rate</label>
                            <input
                                type="number" step="0.005" name="acqRate" value={inputs.acqRate} onChange={handleChange}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Hold Period (ops yrs)</label>
                            <input
                                type="number" name="opsYearsBeforeSale" value={inputs.opsYearsBeforeSale} onChange={handleChange}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Exit Cap</label>
                            <input
                                type="number" step="0.005" name="exitCap" value={inputs.exitCap} onChange={handleChange}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Results */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-[hsl(var(--surface))] rounded-[var(--radius)] border border-[hsl(var(--border))]">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Equity IRR</p>
                            <p className="text-xl font-bold text-[hsl(var(--primary))]">{formatPercent(results.irrTotal)}</p>
                        </div>
                        <div className="p-4 bg-[hsl(var(--surface))] rounded-[var(--radius)] border border-[hsl(var(--border))]">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">CP IRR</p>
                            <p className="text-xl font-bold">{formatPercent(results.irrCp)}</p>
                        </div>
                        <div className="p-4 bg-[hsl(var(--surface))] rounded-[var(--radius)] border border-[hsl(var(--border))]">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">OP IRR</p>
                            <p className="text-xl font-bold">{formatPercent(results.irrOp)}</p>
                        </div>
                    </div>

                    <div className="h-[350px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4">
                        <h3 className="text-sm font-bold mb-4">Operating Distributable Cash Flow</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={results.chartData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="year" />
                                <YAxis />
                                <Tooltip formatter={(val: number | undefined) => formatCurrency(val || 0)} />
                                <Legend />
                                <Bar dataKey="cp" stackId="a" fill="hsl(var(--primary))" name="Capital Partner" />
                                <Bar dataKey="op" stackId="a" fill="hsl(var(--brand-blue))" name="Op Partner" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-[var(--radius)] p-5">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            Sale Event Summary
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex justify-between border-b py-2">
                                <span>Sale Price</span>
                                <span className="font-bold">{formatCurrency(results.salePrice)}</span>
                            </div>
                            <div className="flex justify-between border-b py-2">
                                <span>Senior Debt Payoff</span>
                                <span className="text-red-500">{formatCurrency(results.salePrice - results.netSale)}</span>
                            </div>
                            <div className="flex justify-between border-b py-2">
                                <span>Net to Equity</span>
                                <span className="text-green-600 font-bold">{formatCurrency(results.netSale)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
