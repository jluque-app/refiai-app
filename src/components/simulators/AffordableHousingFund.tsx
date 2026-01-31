"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, Calculator, Info, Settings2, BarChart3, PieChart } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { finance } from "@/lib/finance-math";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

// --- Types ---

interface CountryInput {
    id: string;
    country: string;
    weight: number;
    devIrr: number; // Unlevered Dev IRR (annual)
    exitCap: number; // Stabilized Affordable Yield (NOI/Value) aka Exit Cap
    inflation: number; // CPI
}

interface FundInputs {
    // Step 1: Capital Structure
    privateEquity: number;
    eifEquity: number;
    juniorEquityPct: number; // % of Total Equity (First Loss)

    // Leverage
    fundLeverage: number; // EIB Debt share of TOTAL Capital (0 to 0.8)
    fundDebtRate: number; // EIB Rate (e.g. 0.02)

    // Horizon
    devYears: number;
    holdYears: number; // After development

    // Asset Level Financing (Optional)
    useAssetDevDebt: boolean;
    assetLtc: number; // e.g. 0.60
    assetDevRate: number; // e.g. 0.045

    // Step 5: Long Term Prop Financing
    propLoanRate: number; // Base rate (e.g. 0.045)
    altPropRate: number; // Alt rate (e.g. 0.060)

    // Step 6: Fees & Carry
    mgmtFee: number; // e.g. 0.02
    bankFee: number; // e.g. 0.005
    tokenFee: number; // e.g. 0.005
    promoteRate: number; // e.g. 0.20

    // Impact Rotation
    impactExitPct: number; // % of Private Equity exiting at Y3
    rotationMode: 'Borrow' | 'Sell'; // "Borrow buyout debt" or "Sell stake"
    buyoutRate: number;
}

// --- Defaults ---

const DEFAULT_COUNTRIES: CountryInput[] = [
    { id: '1', country: "Spain", weight: 0.40, devIrr: 0.15, exitCap: 0.045, inflation: 0.025 },
    { id: '2', country: "Portugal", weight: 0.15, devIrr: 0.14, exitCap: 0.0475, inflation: 0.023 },
    { id: '3', country: "Italy", weight: 0.15, devIrr: 0.12, exitCap: 0.0475, inflation: 0.018 },
    { id: '4', country: "Poland", weight: 0.15, devIrr: 0.16, exitCap: 0.0525, inflation: 0.030 },
    { id: '5', country: "Hungary", weight: 0.15, devIrr: 0.18, exitCap: 0.055, inflation: 0.045 },
];

const DEFAULT_FUND: FundInputs = {
    privateEquity: 500000000,
    eifEquity: 200000000,
    juniorEquityPct: 0.0,

    fundLeverage: 0.50, // 50% Debt / 50% Equity
    fundDebtRate: 0.02,

    devYears: 3,
    holdYears: 20,

    useAssetDevDebt: false,
    assetLtc: 0.60,
    assetDevRate: 0.045,

    propLoanRate: 0.045,
    altPropRate: 0.060,

    mgmtFee: 0.02,
    bankFee: 0.005,
    tokenFee: 0.005,
    promoteRate: 0.20,

    impactExitPct: 0.0,
    rotationMode: 'Borrow',
    buyoutRate: 0.0175
};

export default function AffordableHousingFundSimulator() {
    const [fund, setFund] = useState<FundInputs>(DEFAULT_FUND);
    const [countries, setCountries] = useState<CountryInput[]>(DEFAULT_COUNTRIES);
    const [activeTab, setActiveTab] = useState("structure");

    // --- Inputs Handlers ---
    const updateFund = (field: keyof FundInputs, value: any) => {
        setFund(prev => ({ ...prev, [field]: value }));
    };

    const updateCountry = (id: string, field: keyof CountryInput, value: number) => {
        setCountries(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    // --- Core Engine ---
    const results = useMemo(() => {
        // 1. Capital Stack Construction
        const baseEquity = fund.privateEquity + fund.eifEquity; // Private + Public

        // Logic: Junior Equity is added ON TOP to reach the desired % of Total Equity
        let juniorEquity = 0;
        if (fund.juniorEquityPct > 0 && fund.juniorEquityPct < 1) {
            juniorEquity = baseEquity * (fund.juniorEquityPct / (1 - fund.juniorEquityPct));
        }

        const totalEquity = baseEquity + juniorEquity;

        // Debt logic
        let fundDebt = 0;
        if (fund.fundLeverage > 0 && fund.fundLeverage < 1) {
            fundDebt = totalEquity * (fund.fundLeverage / (1 - fund.fundLeverage));
        }

        const totalCapital = totalEquity + fundDebt;

        // 2. Country / Portfolio Mix
        const totalWeight = countries.reduce((s, c) => s + c.weight, 0);
        const normCountries = countries.map(c => ({
            ...c,
            normWeight: totalWeight > 0 ? c.weight / totalWeight : 0
        }));

        let totalDevCost = totalCapital;
        if (fund.useAssetDevDebt) {
            totalDevCost = totalCapital / (1 - fund.assetLtc);
        }
        const assetDevDebt = totalDevCost - totalCapital;

        // Iterate Countries
        let totalValueStab = 0;
        let totalNoiStab = 0;
        let wavgInfl = 0;

        normCountries.forEach(c => {
            const countryCost = totalDevCost * c.normWeight;
            const assetDebtI = fund.useAssetDevDebt ? countryCost * fund.assetLtc : 0;
            const equityLikeI = countryCost - assetDebtI;
            const equityValueStabI = equityLikeI * Math.pow(1 + c.devIrr, fund.devYears);
            const valueStabI = equityValueStabI + assetDebtI;
            const noiStabI = valueStabI * c.exitCap;

            totalValueStab += valueStabI;
            totalNoiStab += noiStabI;
            wavgInfl += c.inflation * c.normWeight;
        });

        // 3. Cashflow Arrays (Common)
        const totalHorizon = fund.devYears + fund.holdYears;
        const timesteps = Array.from({ length: totalHorizon + 1 }, (_, i) => i);

        // NOI Stream
        const noiStream = timesteps.map(t => {
            if (t <= fund.devYears) return 0;
            const yearsStab = t - (fund.devYears + 1);
            return totalNoiStab * Math.pow(1 + wavgInfl, yearsStab);
        });

        // EIB Debt Service (Fund Level)
        const eibSched = finance.amortizationSchedule(fundDebt, fund.fundDebtRate, totalHorizon, fund.devYears);
        const eibPayment = timesteps.map(t => {
            const p = eibSched.find(s => s.period === t);
            return p ? p.payment : 0;
        });

        // --- Strategy A: Exit at Year 3 ---
        const propVal3 = totalValueStab;
        const netProjectEquityVal3 = propVal3 - assetDevDebt;

        const cfEquityA = timesteps.map(t => {
            if (t === 0) return -totalEquity;
            if (t === fund.devYears) {
                const eibBal = fundDebt;
                return netProjectEquityVal3 - eibBal;
            }
            if (t > 0 && t < fund.devYears) return -(fundDebt * fund.fundDebtRate);
            return 0;
        });

        const irrA = finance.irr(cfEquityA);
        const moicA = cfEquityA.reduce((s, x) => x > 0 ? s + x : s, 0) / Math.abs(cfEquityA[0]);

        // --- Strategy B: Hold 50 Years (Standard Levered) ---
        const propLoanPrincipal = totalValueStab * 0.60;
        const propLoanSched = finance.amortizationSchedule(propLoanPrincipal, fund.propLoanRate, fund.holdYears, 0);

        const cfEquityB = timesteps.map(t => {
            if (t === 0) return -totalEquity;

            let flow = 0;
            flow += noiStream[t];
            flow -= eibPayment[t];

            if (t > fund.devYears) {
                const s = propLoanSched.find(x => x.period === (t - fund.devYears));
                if (s) flow -= s.payment;
            }

            if (t === fund.devYears) {
                const refiNet = propLoanPrincipal - assetDevDebt;
                flow += refiNet;
            }

            if (t === totalHorizon) {
                const termNOI = noiStream[t];
                const exitVal = termNOI * 1.02 / 0.045; // Cap next year NOI
                const s = propLoanSched[propLoanSched.length - 1];
                const propLoanBal = s ? s.balance : 0;
                const e = eibSched.find(x => x.period === t);
                const eibBal = e ? e.balance : 0;

                flow += (exitVal - propLoanBal - eibBal);
            }
            return flow;
        });

        const irrB = finance.irr(cfEquityB);
        const moicB = cfEquityB.reduce((s, x) => x > 0 ? s + x : s, 0) / Math.abs(cfEquityB[0]);

        // --- Waterfall (Fees & Carry) on Strategy B ---
        const feeBase = baseEquity;
        const mgmtFeeAmt = feeBase * fund.mgmtFee;

        const waterfall = {
            lpNet: [] as number[],
            founder: [] as number[]
        };

        const cfNetOfFees = cfEquityB.map((f, t) => {
            if (t === 0) return f;
            let net = f - mgmtFeeAmt;
            // Founder gets Fee
            waterfall.founder.push(mgmtFeeAmt);
            return net;
        });

        const totalProfit = cfNetOfFees.reduce((s, x) => s + x, 0);
        const carry = totalProfit > 0 ? totalProfit * fund.promoteRate : 0;

        const cfNet = [...cfNetOfFees];
        if (cfNet[totalHorizon] > 0) {
            cfNet[totalHorizon] -= carry;
            // Founder gets Carry
            if (waterfall.founder[totalHorizon - 1]) waterfall.founder[totalHorizon - 1] += carry;
        }

        return {
            totalCapital,
            totalEquity,
            fundDebt,
            juniorEquity,
            baseEquity,
            totalValueStab,
            totalNoiStab,
            avgCap: totalNoiStab / totalValueStab,
            timesteps,
            cfEquityB,
            irrB,
            moicB,
            irrA,
            moicA,
            waterfall,
            feeTotal: mgmtFeeAmt * totalHorizon,
            carryTotal: carry,
            strategies: [
                { id: "A", name: "Strategy A (Exit Y3)", desc: "Sell at stabilization", irr: irrA, moic: moicA },
                { id: "B", name: "Strategy B (Hold 50y)", desc: "Refinance & Hold", irr: irrB, moic: moicB }
            ]
        };

    }, [fund, countries]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Legacy Fund Simulator</h2>
                <p className="text-muted-foreground">
                    Advanced modeling of a pan-European affordable housing fund with EIB leverage, tranche structuring, and multiple exit strategies.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="structure">1. Structure</TabsTrigger>
                    <TabsTrigger value="portfolio">2. Portfolio</TabsTrigger>
                    <TabsTrigger value="analysis">3. Analysis</TabsTrigger>
                </TabsList>

                {/* --- TAB 1: STRUCTURE (Inputs) --- */}
                <TabsContent value="structure" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <PieChart className="w-5 h-5" />
                                    Fund Capital Stack
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Private Equity (€)</Label>
                                    <Input
                                        type="number"
                                        value={fund.privateEquity}
                                        onChange={e => updateFund('privateEquity', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>EIF / Public Equity (€)</Label>
                                    <Input
                                        type="number"
                                        value={fund.eifEquity}
                                        onChange={e => updateFund('eifEquity', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Junior (First-Loss) % of Total Equity</Label>
                                    <div className="flex items-center gap-4">
                                        <Slider
                                            value={[fund.juniorEquityPct]}
                                            min={0} max={0.50} step={0.05}
                                            onValueChange={([v]) => updateFund('juniorEquityPct', v)}
                                            className="flex-1"
                                        />
                                        <span className="w-12 text-sm font-mono">{formatPercent(fund.juniorEquityPct)}</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Total Equity:</span>
                                        <span className="font-bold">{formatCurrency(results.totalEquity)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pl-4 border-l-2 border-green-500">
                                        <span className="text-muted-foreground">Junior Tranche:</span>
                                        <span>{formatCurrency(results.juniorEquity)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm pl-4 border-l-2 border-blue-500">
                                        <span className="text-muted-foreground">Senior Tranche:</span>
                                        <span>{formatCurrency(results.baseEquity)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings2 className="w-5 h-5" />
                                    Leverage & Terms
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Fund Leverage (EIB % of Total Capital)</Label>
                                    <div className="flex items-center gap-4">
                                        <Slider
                                            value={[fund.fundLeverage]}
                                            min={0} max={0.80} step={0.05}
                                            onValueChange={([v]) => updateFund('fundLeverage', v)}
                                            className="flex-1"
                                        />
                                        <span className="w-12 text-sm font-mono">{formatPercent(fund.fundLeverage)}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>EIB Rate</Label>
                                        <Input
                                            type="number" step="0.001"
                                            value={fund.fundDebtRate}
                                            onChange={e => updateFund('fundDebtRate', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Total Capital</Label>
                                        <div className="h-10 px-3 py-2 bg-muted rounded-md text-sm font-mono flex items-center">
                                            {formatCurrency(results.totalCapital)}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Dev Years</Label>
                                        <Input
                                            type="number"
                                            value={fund.devYears}
                                            onChange={e => updateFund('devYears', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hold Years</Label>
                                        <Input
                                            type="number"
                                            value={fund.holdYears}
                                            onChange={e => updateFund('holdYears', parseFloat(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- TAB 2: PORTFOLIO (Assumptions) --- */}
                <TabsContent value="portfolio" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Country Allocation & Assumptions</CardTitle>
                            <CardDescription>
                                Weighted average of development projects across target geographies.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Country</TableHead>
                                        <TableHead className="w-[120px]">Alloc. Weight</TableHead>
                                        <TableHead className="w-[120px]">Dev IRR</TableHead>
                                        <TableHead className="w-[120px]">Exit Cap (Yield)</TableHead>
                                        <TableHead className="w-[120px]">CPI</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {countries.map(country => (
                                        <TableRow key={country.id}>
                                            <TableCell className="font-medium">{country.country}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number" step="0.05"
                                                    value={country.weight}
                                                    onChange={e => updateCountry(country.id, 'weight', parseFloat(e.target.value))}
                                                    className="w-20"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number" step="0.01"
                                                    value={country.devIrr}
                                                    onChange={e => updateCountry(country.id, 'devIrr', parseFloat(e.target.value))}
                                                    className="w-20"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number" step="0.0025"
                                                    value={country.exitCap}
                                                    onChange={e => updateCountry(country.id, 'exitCap', parseFloat(e.target.value))}
                                                    className="w-20"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number" step="0.001"
                                                    value={country.inflation}
                                                    onChange={e => updateCountry(country.id, 'inflation', parseFloat(e.target.value))}
                                                    className="w-20"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="mt-4 p-4 bg-muted/50 rounded-lg flex gap-8">
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Stabilized Value (Y3)</span>
                                    <div className="text-xl font-bold">{formatCurrency(results.totalValueStab)}</div>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Stabilized NOI (Y3)</span>
                                    <div className="text-xl font-bold">{formatCurrency(results.totalNoiStab)}</div>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Avg Yield</span>
                                    <div className="text-xl font-bold">{formatPercent(results.avgCap)}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- TAB 3: ANALYSIS (Results) --- */}
                <TabsContent value="analysis" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT: Strategy Table */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Strategy Comparison</CardTitle>
                                <CardDescription>Exit at stabilization (Year 3) vs. Long-term Hold (Year 50).</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Strategy</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Nominal IRR</TableHead>
                                            <TableHead className="text-right">Multipler (MOIC)</TableHead>
                                            <TableHead className="text-right">Profit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.strategies.map((s) => (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-bold">{s.name}</TableCell>
                                                <TableCell className="text-muted-foreground">{s.desc}</TableCell>
                                                <TableCell className="text-right font-mono text-primary font-bold">
                                                    {formatPercent(s.irr)}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {s.moic.toFixed(2)}x
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground text-xs">
                                                    --
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* LEFT: Cashflow Chart */}
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle>Annual Net Cashflow (Strategy B)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={results.timesteps.map(t => ({
                                            year: t,
                                            flow: results.cfEquityB[t]
                                        }))}>
                                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                            <XAxis dataKey="year" />
                                            <YAxis tickFormatter={(val) => `€${val / 1000000}M`} />
                                            <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                                            <Bar dataKey="flow" fill="hsl(var(--primary))" name="Equity Net Cash Flow" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* RIGHT: Waterfall Breakdown */}
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle>Fee & Promote Waterfall (Strategy B)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                                        <span className="text-sm font-medium">Total Fees (Mgmt):</span>
                                        <span className="font-mono">{formatCurrency(results.feeTotal)}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                                        <span className="text-sm font-medium">Carried Interest (Promote):</span>
                                        <span className="font-mono text-amber-600 font-bold">{formatCurrency(results.carryTotal)}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-t pt-3">
                                        <span className="text-sm font-bold">Total Founder Income:</span>
                                        <span className="font-mono font-bold">{formatCurrency(results.feeTotal + results.carryTotal)}</span>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    * Assumes 2% Management Fee on Paid-in Capital + 20% Promote on Profits.
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

            </Tabs>
        </div>
    );
}
