"use client";

import { useState, useMemo } from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, ComposedChart, Area
} from "recharts";
import { Download, RefreshCw, Info } from "lucide-react";

// Helper for currency formatting
const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

const formatPercent = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(val);

export default function SingleAssetValuationSimulator() {
    // -------------------------------------------------------------------------
    // 1. STATE & INPUTS (Default values from module4_single_v5.py)
    // -------------------------------------------------------------------------
    const [inputs, setInputs] = useState({
        // Property
        pgi_y1: 10000,
        growth: 0.025,
        vacancy: 0.05,
        opex: 0.30, // 30% of EGI approx, python used 0.05 of EGI? Checking python: 5.0%... wait, 5% opex is very low. Default in python was 5.0 (percent input).
        // Python code: opex_rate, opex_pct = percent_input("Opex (of EGI)", 5.0...
        // 5% Opex is unrealistic for real estate, usually 30-40%. But I will stick to python defaults for fidelity initially.
        capex: 0.0,

        // Valuation
        disc_rate: 0.10,
        term_cap: 0.0825,
        sale_cost: 0.02,
        years: 5,

        // Debt
        ltv: 0.70,
        loan_rate: 0.05,
        amort: 25,

        // Waterfall / Equity
        cumulative: false,
        pref_invest: 5000,
        pref_rate: 0.11,

        // Common Equity Splits (Capital Partner / Operating Partner)
        cp_share: 0.90,
        op_share: 0.10,

        // Prefs (Hurdles)
        cp_pref: 0.12,
        op_pref: 0.12,

        // Operating Cash Flow Splits (Promote)
        cp_ops_split: 0.90,
        op_ops_split: 0.10,

        // Sale Cash Flow Splits
        cp_sale_split: 0.70,
        op_sale_split: 0.30
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setInputs(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : parseFloat(value)
        }));
    };

    // -------------------------------------------------------------------------
    // 2. CALCULATIONS
    // -------------------------------------------------------------------------
    const results = useMemo(() => {
        const {
            pgi_y1, growth, vacancy, opex, capex, disc_rate, term_cap, sale_cost, years,
            ltv, loan_rate, amort, cumulative, pref_invest, pref_rate,
            cp_share, cp_pref, op_pref, cp_ops_split, cp_sale_split
        } = inputs;

        // --- A. Property Cash Flows ---
        const cfData = [];
        let currentPgi = pgi_y1;

        for (let t = 1; t <= years; t++) {
            const vacAmt = currentPgi * vacancy;
            const egi = currentPgi - vacAmt;
            const opexAmt = egi * opex;
            const capexAmt = egi * capex;
            const noi = egi - opexAmt - capexAmt;

            cfData.push({
                year: t,
                pgi: currentPgi,
                vacancy: vacAmt,
                egi,
                opex: opexAmt,
                capex: capexAmt,
                noi,
                debtService: 0,
                btcf: 0
            });

            // Grow PGI for next year
            if (t < years) currentPgi *= (1 + growth);
        }

        // --- B. Valuation (DCF) ---
        // Terminal Value
        const nextYearNOI = cfData[years - 1].noi * (1 + growth);
        const termVal = nextYearNOI / term_cap;
        const nsp = termVal * (1 - sale_cost); // Net Sale Proceeds

        // PV of Operations
        let pvOps = 0;
        cfData.forEach((row, idx) => {
            pvOps += row.noi / Math.pow(1 + disc_rate, row.year);
        });

        // PV of Sale
        const pvSale = nsp / Math.pow(1 + disc_rate, years);

        const dcfValue = pvOps + pvSale;

        // --- C. Debt ---
        const loanAmt = dcfValue * ltv;
        const equityReq = dcfValue - loanAmt;

        // PMT
        const r_monthly = loan_rate / 12.0;
        const n_months_total = amort * 12;
        // PMT Formula: P * r / (1 - (1+r)^-n)
        let pmt = 0;
        if (r_monthly > 0) {
            pmt = (loanAmt * r_monthly) / (1 - Math.pow(1 + r_monthly, -n_months_total));
        } else {
            pmt = loanAmt / n_months_total;
        }
        const annualDebtService = pmt * 12;

        // OLB at End (FV)
        // FV = P(1+r)^n - PMT * ((1+r)^n - 1) / r
        const n_months_hold = years * 12;
        let olbEnd = 0;
        if (r_monthly > 0) {
            olbEnd = loanAmt * Math.pow(1 + r_monthly, n_months_hold) -
                pmt * (Math.pow(1 + r_monthly, n_months_hold) - 1) / r_monthly;
        } else {
            olbEnd = loanAmt - (pmt * n_months_hold);
        }

        const bter = nsp - olbEnd; // Before Tax Equity Reversion

        // Add Debt Service to CF Data
        cfData.forEach(row => {
            row.debtService = annualDebtService;
            row.btcf = row.noi - annualDebtService;
        });

        // --- D. Waterfall ---
        // Common Equity Required
        const commonEqReq = Math.max(equityReq - pref_invest, 0);
        const cp_invest = commonEqReq * cp_share;
        const op_invest = commonEqReq * (1 - cp_share); // op_share

        // Arrays to store distribution
        const distributions = [];

        let pref_arrears = 0;
        let cp_arrears = 0;
        let op_arrears = 0;

        // Loop through operating years
        for (let t = 0; t < years; t++) {
            let avail = cfData[t].btcf;
            const distRow: any = { year: t + 1, avail };

            // 1. Preferred Equity
            const pref_due = pref_invest * pref_rate;
            const pref_req = pref_due + (cumulative ? pref_arrears : 0);
            const pay_pref = Math.min(avail, pref_req);
            distRow.pay_pref = pay_pref;
            avail -= pay_pref;
            if (cumulative) pref_arrears = Math.max(pref_req - pay_pref, 0);

            // 2. CP Pref
            const cp_due = cp_invest * cp_pref;
            const cp_req = cp_due + (cumulative ? cp_arrears : 0);
            const pay_cp = Math.min(avail, cp_req);
            distRow.pay_cp = pay_cp;
            avail -= pay_cp;
            if (cumulative) cp_arrears = Math.max(cp_req - pay_cp, 0);

            // 3. OP Pref
            const op_due = op_invest * op_pref;
            const op_req = op_due + (cumulative ? op_arrears : 0);
            const pay_op = Math.min(avail, op_req);
            distRow.pay_op = pay_op;
            avail -= pay_op;
            if (cumulative) op_arrears = Math.max(op_req - pay_op, 0);

            // 4. Pari Passu (Remainder)
            if (avail > 0) {
                distRow.cp_resid = avail * cp_ops_split;
                distRow.op_resid = avail * (1 - cp_ops_split); // op_ops_split
            } else {
                distRow.cp_resid = 0;
                distRow.op_resid = 0;
            }

            distributions.push(distRow);
        }

        // Sale Waterfall
        let saleCash = bter;
        const saleDist: any = {};

        if (cumulative) {
            const pay_pref_arr = Math.min(saleCash, pref_arrears);
            saleDist.pref_arrears = pay_pref_arr;
            saleCash -= pay_pref_arr;

            const pay_cp_arr = Math.min(saleCash, cp_arrears);
            saleDist.cp_arrears = pay_cp_arr;
            saleCash -= pay_cp_arr;

            const pay_op_arr = Math.min(saleCash, op_arrears);
            saleDist.op_arrears = pay_op_arr;
            saleCash -= pay_op_arr;
        }

        // Return Capital
        const pref_ret = Math.min(pref_invest, saleCash);
        saleDist.pref_ret = pref_ret;
        saleCash -= pref_ret;

        const cp_ret = Math.min(cp_invest, saleCash);
        saleDist.cp_ret = cp_ret;
        saleCash -= cp_ret;

        const op_ret = Math.min(op_invest, saleCash);
        saleDist.op_ret = op_ret;
        saleCash -= op_ret;

        // Residual
        saleDist.cp_resid = saleCash * cp_sale_split;
        saleDist.op_resid = saleCash * (1 - cp_sale_split);

        // --- Summary Metris ---

        return {
            dcfValue,
            loanAmt,
            equityReq,
            commonEqReq,
            cp_invest,
            op_invest,
            annualDebtService,
            olbEnd,
            bter,
            cfData,
            distributions,
            saleDist
        };

    }, [inputs]);

    return (
        <div className="space-y-8 p-1">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Inputs Column */}
                <div className="lg:col-span-1 space-y-6 bg-[hsl(var(--surface))] p-6 rounded-[var(--radius)] border border-[hsl(var(--border))] h-fit max-h-[800px] overflow-y-auto">
                    <h3 className="font-bold flex items-center gap-2">
                        Model Inputs
                    </h3>

                    {/* Property Inputs */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase text-[hsl(var(--primary))]">Property</h4>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">PGI Year 1</label>
                            <input
                                type="number" name="pgi_y1" value={inputs.pgi_y1} onChange={handleInputChange}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Growth</label>
                                <input
                                    type="number" step="0.005" name="growth" value={inputs.growth} onChange={handleInputChange}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Vacancy</label>
                                <input
                                    type="number" step="0.01" name="vacancy" value={inputs.vacancy} onChange={handleInputChange}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Horizon (Years)</label>
                            <input
                                type="number" name="years" value={inputs.years} onChange={handleInputChange}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    {/* Valuation Inputs */}
                    <div className="space-y-4 pt-4 border-t border-[hsl(var(--border))]">
                        <h4 className="text-xs font-bold uppercase text-[hsl(var(--primary))]">Valuation & Sale</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Disc Rate</label>
                                <input
                                    type="number" step="0.005" name="disc_rate" value={inputs.disc_rate} onChange={handleInputChange}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Term Cap</label>
                                <input
                                    type="number" step="0.005" name="term_cap" value={inputs.term_cap} onChange={handleInputChange}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Sale Cost %</label>
                            <input
                                type="number" step="0.01" name="sale_cost" value={inputs.sale_cost} onChange={handleInputChange}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    {/* Debt Inputs */}
                    <div className="space-y-4 pt-4 border-t border-[hsl(var(--border))]">
                        <h4 className="text-xs font-bold uppercase text-[hsl(var(--primary))]">Financing</h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">LTV</label>
                                <input
                                    type="number" step="0.05" name="ltv" value={inputs.ltv} onChange={handleInputChange}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Rate</label>
                                <input
                                    type="number" step="0.005" name="loan_rate" value={inputs.loan_rate} onChange={handleInputChange}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Amortization</label>
                            <input
                                type="number" name="amort" value={inputs.amort} onChange={handleInputChange}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    {/* Waterfall Inputs */}
                    <div className="space-y-4 pt-4 border-t border-[hsl(var(--border))]">
                        <h4 className="text-xs font-bold uppercase text-[hsl(var(--primary))]">JV Waterfall</h4>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Pref Equity Invest</label>
                            <input
                                type="number" name="pref_invest" value={inputs.pref_invest} onChange={handleInputChange}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Pref Rate</label>
                                <input
                                    type="number" step="0.01" name="pref_rate" value={inputs.pref_rate} onChange={handleInputChange}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-6">
                                <input
                                    type="checkbox" name="cumulative" checked={inputs.cumulative} onChange={handleInputChange}
                                    className="accent-[hsl(var(--primary))]"
                                />
                                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Cumulative?</label>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 border-t border-[hsl(var(--border))] pt-2 mt-2">
                            <div>
                                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">CP Share</label>
                                <input
                                    type="number" step="0.05" name="cp_share" value={inputs.cp_share} onChange={handleInputChange}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Promote Split</label>
                                <input
                                    type="number" step="0.05" name="cp_sale_split" value={inputs.cp_sale_split} onChange={handleInputChange}
                                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Column */}
                <div className="lg:col-span-3 space-y-6 overflow-y-auto h-[calc(100vh-200px)] pr-2">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-[hsl(var(--muted)/0.2)] rounded-[var(--radius)] border border-[hsl(var(--border))]">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Property Value (DCF)</p>
                            <p className="text-xl font-bold text-[hsl(var(--primary))]">{formatCurrency(results.dcfValue)}</p>
                        </div>
                        <div className="p-4 bg-[hsl(var(--muted)/0.2)] rounded-[var(--radius)] border border-[hsl(var(--border))]">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Loan Amount</p>
                            <p className="text-xl font-bold">{formatCurrency(results.loanAmt)}</p>
                        </div>
                        <div className="p-4 bg-[hsl(var(--muted)/0.2)] rounded-[var(--radius)] border border-[hsl(var(--border))]">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Equity Required</p>
                            <p className="text-xl font-bold">{formatCurrency(results.equityReq)}</p>
                        </div>
                        <div className="p-4 bg-[hsl(var(--muted)/0.2)] rounded-[var(--radius)] border border-[hsl(var(--border))]">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">Net Sale Proceeds</p>
                            <p className="text-xl font-bold">{formatCurrency(results.bter + results.olbEnd)}</p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="h-[300px] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4 bg-[hsl(var(--surface))]">
                        <h3 className="text-sm font-bold mb-4">Operating Cash Flows</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={results.cfData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis dataKey="year" />
                                <YAxis />
                                <Tooltip formatter={(val: number | undefined) => formatCurrency(val || 0)} />
                                <Legend />
                                <Bar dataKey="noi" fill="hsl(var(--primary))" name="NOI" />
                                <Line type="monotone" dataKey="debtService" stroke="#ff7300" name="Debt Service" dot={false} />
                                <Area type="monotone" dataKey="btcf" fill="#82ca9d" stroke="#82ca9d" fillOpacity={0.3} name="BTCF" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Waterfall Table */}
                    <div className="border border-[hsl(var(--border))] rounded-[var(--radius)] p-6 bg-[hsl(var(--surface))]">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            Waterfall Distribution
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-[hsl(var(--muted-foreground))] uppercase bg-[hsl(var(--muted)/0.2)]">
                                    <tr>
                                        <th className="px-4 py-2">Year</th>
                                        <th className="px-4 py-2">Avail Cash</th>
                                        <th className="px-4 py-2">Pref Equity</th>
                                        <th className="px-4 py-2">Capital Partner</th>
                                        <th className="px-4 py-2">Operating Partner</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[hsl(var(--border))]">
                                    {results.distributions.map((row: any) => (
                                        <tr key={row.year} className="hover:bg-[hsl(var(--muted)/0.1)]">
                                            <td className="px-4 py-2 font-medium">{row.year}</td>
                                            <td className="px-4 py-2">{formatCurrency(row.avail)}</td>
                                            <td className="px-4 py-2 text-blue-600 font-medium">{formatCurrency(row.pay_pref)}</td>
                                            <td className="px-4 py-2">{formatCurrency(row.pay_cp + row.cp_resid)}</td>
                                            <td className="px-4 py-2">{formatCurrency(row.pay_op + row.op_resid)}</td>
                                        </tr>
                                    ))}
                                    {/* Sale Year Summary Row */}
                                    <tr className="bg-[hsl(var(--primary)/0.05)] font-bold">
                                        <td className="px-4 py-2">SALE</td>
                                        <td className="px-4 py-2">{formatCurrency(results.bter)}</td>
                                        <td className="px-4 py-2 text-blue-600">{formatCurrency(results.saleDist.pref_ret + (results.saleDist.pref_arrears || 0))}</td>
                                        <td className="px-4 py-2">{formatCurrency(results.saleDist.cp_ret + (results.saleDist.cp_arrears || 0) + results.saleDist.cp_resid)}</td>
                                        <td className="px-4 py-2">{formatCurrency(results.saleDist.op_ret + (results.saleDist.op_arrears || 0) + results.saleDist.op_resid)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
