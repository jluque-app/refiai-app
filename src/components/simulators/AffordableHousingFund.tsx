"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, TrendingUp, Calculator, Info, Settings2, BarChart3, PieChart, ArrowLeft, Building, Bug, RotateCcw, Plus, Trash2, Target, Globe, Shield, FileText, Clock, Lightbulb, CheckCircle, XCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { finance } from "@/lib/finance-math";
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import * as XLSX from 'xlsx';
import MermaidChart from '@/components/ui/mermaid';

// --- Types ---

interface CountryInput {
    id: string;
    country: string;
    weight: number;
    devIrr: number; // Unlevered IRR target
    exitCap: number; // Stabilized Yield (NOI / Market Price for next year)
    inflation: number; // CPI Assumed
    marketRentGrowth: number; // Market Rent Growth (for Exit Uplift)
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
    assetLtvStabilized?: number; // Optional asset leverage at stabilization

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

    // --- V2 Upgrade: Advanced Waterfall ---
    hurdleRate: number; // e.g. 0.08
    catchUpRate: number; // e.g. 1.0 (100% catch-up to GP)

    // --- V2 Upgrade: Advanced Valuation ---
    valuationMethod: 'simple' | 'two-stage';
    exitValuationMode: 'no-uplift' | 'market-growth' | 'manual-cap' | 'two-stage'; // Updated Option
    manualExitCap: number; // For manual-cap mode
    affordableYears: number; // e.g. 20 (Social period)
    valuationDiscountRate: number; // e.g. 0.06
    marketCapAfterAffordability: number; // e.g. 0.05
    marketUplift: number; // e.g. 1.25 (25% uplift)

    // --- Phase 3 Refinement: Preferred Equity ---
    preferredEquity: number; // Amount in EUR
    preferredRate: number; // Coupon rate (e.g. 0.08)
}

// --- Defaults ---

const DEFAULT_COUNTRIES: CountryInput[] = [
    { id: '1', country: "Sweden", weight: 0.27, devIrr: 0.08, exitCap: 0.035, inflation: 0.018, marketRentGrowth: 0.028 },
    { id: '2', country: "Poland", weight: 0.17, devIrr: 0.15, exitCap: 0.055, inflation: 0.038, marketRentGrowth: 0.048 },
    { id: '3', country: "France", weight: 0.11, devIrr: 0.09, exitCap: 0.035, inflation: 0.020, marketRentGrowth: 0.030 },
    { id: '4', country: "Spain", weight: 0.10, devIrr: 0.11, exitCap: 0.040, inflation: 0.022, marketRentGrowth: 0.032 },
    { id: '5', country: "Netherlands", weight: 0.10, devIrr: 0.10, exitCap: 0.038, inflation: 0.021, marketRentGrowth: 0.031 },
    { id: '6', country: "Czech Republic", weight: 0.10, devIrr: 0.14, exitCap: 0.050, inflation: 0.035, marketRentGrowth: 0.045 },
    { id: '7', country: "Hungary", weight: 0.10, devIrr: 0.14, exitCap: 0.050, inflation: 0.035, marketRentGrowth: 0.045 },
];

const DEFAULT_FUND: FundInputs = {
    privateEquity: 500000000,
    eifEquity: 200000000,
    juniorEquityPct: 0.0,

    fundLeverage: 0.0, // Default 0% (100% Equity)
    fundDebtRate: 0.02,

    devYears: 3,
    holdYears: 20,

    useAssetDevDebt: true, // Enabled by default
    assetLtc: 0.70, // Generous leverage
    assetDevRate: 0.045,
    assetLtvStabilized: 0.70, // Matches LTC to avoid Year 3 capital call

    propLoanRate: 0.0175, // Cheap credit line
    altPropRate: 0.060,

    mgmtFee: 0.02,
    bankFee: 0.005,
    tokenFee: 0.005,
    promoteRate: 0.20,

    // V2 Defaults
    hurdleRate: 0.08,
    catchUpRate: 1.0,

    // Phase 3 Defaults
    preferredEquity: 0,
    preferredRate: 0.08,

    valuationMethod: 'simple',
    exitValuationMode: 'market-growth', // Default per request
    manualExitCap: 0.045,
    affordableYears: 20,
    valuationDiscountRate: 0.06,
    marketCapAfterAffordability: 0.042, // Weighted avg of optimized portfolio
    marketUplift: 1.0,

    impactExitPct: 0.5, // Enabled by default (50% exit)
    rotationMode: 'Borrow',
    buyoutRate: 0.0175
};

// --- Helper: True Waterfall (European) ---
// --- Helper: True Waterfall (European) ---
function runWaterfall(
    availableCash: number[],
    investedCapital: number,
    hurdleRate: number,
    promoteRate: number,
    catchUpRate: number // usually 1.0 (100% catchup) or 0.5 etc.
) {
    const n = availableCash.length;
    const lpCash = new Array(n).fill(0);
    const gpCash = new Array(n).fill(0);
    const progression: any[] = [];

    // Initial Outflow
    lpCash[0] = -investedCapital;

    let unrecoveredCapital = investedCapital;
    let accruedHurdle = 0;

    let lpProfitReceived = 0;
    let gpProfitReceived = 0;

    for (let t = 1; t < n; t++) {
        // Accrue Hurdle (on unrecovered capital)
        if (unrecoveredCapital > 1e-12) {
            accruedHurdle += unrecoveredCapital * hurdleRate;
        }

        let cash = availableCash[t];
        let cashStart = cash;

        // Track paid amounts for this year
        let rocPaid = 0;
        let hurdlePaid = 0;
        let catchupPaidGp = 0;
        let residualLp = 0;
        let residualGp = 0;

        if (cash <= 0) {
            // Negative cashflow (capital call) - usually handled in Year 0 but just in case
            lpCash[t] += cash;
        } else {
            // 1. Return of Capital
            if (unrecoveredCapital > 0) {
                const pay = Math.min(cash, unrecoveredCapital);
                rocPaid = pay;
                lpCash[t] += pay;
                cash -= pay;
                unrecoveredCapital -= pay;
            }

            // 2. Preferred Return (Hurdle)
            if (cash > 0 && accruedHurdle > 0) {
                const pay = Math.min(cash, accruedHurdle);
                hurdlePaid = pay;
                lpCash[t] += pay;
                cash -= pay;
                accruedHurdle -= pay;
                lpProfitReceived += pay;
            }

            // 3. Catch-up to GP
            if (cash > 0 && promoteRate > 0) {
                const totalProfitSoFar = lpProfitReceived + gpProfitReceived;
                // Target GP Profit = Promote * (Total Profit)
                const gpTarget = (promoteRate * totalProfitSoFar) / Math.max(1e-12, (1.0 - promoteRate));
                const gpNeeded = Math.max(gpTarget - gpProfitReceived, 0);

                if (gpNeeded > 1e-12) {
                    const effectiveCatchup = Math.max(Math.min(catchUpRate, 1.0), 0.0);
                    // Standard catchup: GP gets 'effectiveCatchup' % of available cash until caught up?
                    // Legacy Logic: "cash_required = gp_needed / effective_to_gp"
                    // Wait, if catchUpRate is 100%, GP takes ALL cash until caught up.
                    // If catchUpRate is 50%, GP takes 50% of cash, LP takes 50%.

                    const cashRequired = gpNeeded / Math.max(effectiveCatchup, 1e-12);
                    const take = Math.min(cash, cashRequired);

                    const gpTake = take * effectiveCatchup;
                    const lpTake = take - gpTake;

                    catchupPaidGp = gpTake;
                    gpCash[t] += gpTake;
                    lpCash[t] += lpTake;

                    gpProfitReceived += gpTake;
                    lpProfitReceived += lpTake;

                    cash -= take;
                }
            }

            // 4. Carried Interest (Promote)
            if (cash > 0) {
                residualGp = cash * promoteRate;
                residualLp = cash - residualGp;

                gpCash[t] += residualGp;
                lpCash[t] += residualLp;

                gpProfitReceived += residualGp;
                lpProfitReceived += residualLp;

                cash = 0;
            }
        }

        progression.push({
            year: t,
            cashAvailable: cashStart,
            paidRoc: rocPaid,
            paidHurdle: hurdlePaid,
            paidCatchup: catchupPaidGp,
            paidPromote: residualGp,
            paidResidual: residualLp, // Note: strictly this is LP share of residual
            unrecoveredCapital: unrecoveredCapital,
            accruedHurdle: accruedHurdle
        });
    }

    return { lpCash, gpCash, progression };
}

// --- Helper: First Loss Allocation ---
function allocateCommonToTranches(
    commonNetCf: number[],
    privateEquity0: number,
    eifEquity0: number,
    juniorEquity0: number
) {
    const n = commonNetCf.length;
    const priv = new Array(n).fill(0);
    const eif = new Array(n).fill(0);
    const jun = new Array(n).fill(0);

    priv[0] = -privateEquity0;
    eif[0] = -eifEquity0;
    jun[0] = -juniorEquity0;

    const total0 = privateEquity0 + eifEquity0 + juniorEquity0;
    const wPriv = total0 > 0 ? privateEquity0 / total0 : 0;
    const wEif = total0 > 0 ? eifEquity0 / total0 : 0;
    const wJun = total0 > 0 ? juniorEquity0 / total0 : 0;

    // Senior/Pari-passu ratio denominator (excluding Junior)
    const denom = wPriv + wEif;

    let juniorRemaining = juniorEquity0;

    for (let t = 1; t < n; t++) {
        const x = commonNetCf[t];
        if (x >= 0) {
            // Profits: distributed pro-rata to capital contributed
            priv[t] += x * wPriv;
            eif[t] += x * wEif;
            jun[t] += x * wJun;
        } else {
            // Losses: Junior absorbs first
            const loss = x; // negative
            let juniorAbsorb = 0;

            if (juniorRemaining > 0) {
                // simple max logic, accounting for negative numbers
                // we want to absorb as much of 'loss' as possible, up to 'juniorRemaining'
                // loss is -100, remaining is 50. Absorb = -50. Rem loss = -50.
                juniorAbsorb = Math.max(loss, -juniorRemaining);
                juniorRemaining += juniorAbsorb; // decrease remaining capital
            }

            jun[t] += juniorAbsorb;
            const remLoss = loss - juniorAbsorb;

            if (Math.abs(denom) > 1e-12) {
                priv[t] += remLoss * (wPriv / denom);
                eif[t] += remLoss * (wEif / denom);
            }
        }
    }

    return { privateCf: priv, eifCf: eif, juniorCf: jun };
}

// --- Helper: Two-Stage Exit Valuation ---
function exitValueTwoStage(
    noiExitAffordable: number,
    affYearsRemaining: number,
    growthRate: number,
    discountRate: number,
    marketCapAfterAffordability: number,
    marketRentUplift: number
) {
    let pvAffStream = 0;

    // PV of Affordable NOI during remaining restricted period
    for (let k = 1; k <= affYearsRemaining; k++) {
        const noiK = noiExitAffordable * Math.pow(1 + growthRate, k - 1);
        pvAffStream += noiK / Math.pow(1 + discountRate, k);
    }

    // Terminal Value at end of restricted period
    const noiEndAff = noiExitAffordable * Math.pow(1 + growthRate, Math.max(affYearsRemaining - 1, 0));
    const noiMarket = noiEndAff * Math.max(marketRentUplift, 1.0);

    const terminalValue = marketCapAfterAffordability > 0 ? noiMarket / marketCapAfterAffordability : 0;
    const pvTerminal = terminalValue / Math.pow(1 + discountRate, Math.max(affYearsRemaining, 1));

    return {
        pvAffStream,
        pvTerminal,
        exitValue: pvAffStream + pvTerminal
    };
}

// --- Helper: Two-Stage Valuation ---
function calculateTwoStageExit(
    noiExit: number,
    inflation: number,
    discountRate: number,
    yearsSinceStab: number,
    totalAffordableYears: number, // from stability
    marketCap: number,
    marketUplift: number
) {
    // If we are already past the affordable period, just use market value
    const remainingAffordable = Math.max(0, totalAffordableYears - yearsSinceStab);

    let pvAffordableStream = 0;

    // 1. PV of remaining affordable NOI
    for (let k = 1; k <= remainingAffordable; k++) {
        const futureNoi = noiExit * Math.pow(1 + inflation, k - 1); // rough growth
        pvAffordableStream += futureNoi / Math.pow(1 + discountRate, k);
    }

    // 2. Terminal Value at end of affordable period
    // NOI at end of affordable period
    const noiAtSwitch = noiExit * Math.pow(1 + inflation, remainingAffordable);
    const noiMarket = noiAtSwitch * marketUplift;
    const terminalValue = noiMarket / marketCap;

    // Discount Terminal Value back to NOW (exit year)
    const pvTerminal = terminalValue / Math.pow(1 + discountRate, remainingAffordable);

    return pvAffordableStream + pvTerminal;
}

export default function AffordableHousingFundSimulator() {
    const [fund, setFund] = useState<FundInputs>(DEFAULT_FUND);
    const [countries, setCountries] = useState<CountryInput[]>(DEFAULT_COUNTRIES);
    const [activeTab, setActiveTab] = useState("course");

    // --- Inputs Handlers ---
    const updateFund = (field: keyof FundInputs, value: any) => {
        setFund(prev => ({ ...prev, [field]: value }));
    };

    const updateCountry = (id: string, field: keyof CountryInput, value: number | string) => {
        setCountries(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const addCountry = () => {
        const nextId = Math.max(0, ...countries.map(c => parseInt(c.id))) + 1;
        setCountries(prev => [...prev, {
            id: nextId.toString(),
            country: "New Country",
            weight: 0.10,
            devIrr: 0.15,
            exitCap: 0.05,
            inflation: 0.02,
            marketRentGrowth: 0.03
        }]);
    };

    const removeCountry = (id: string) => {
        setCountries(prev => prev.filter(c => c.id !== id));
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
        let wavgMarketGrowth = 0;

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
            wavgMarketGrowth += (c.marketRentGrowth || 0) * c.normWeight;
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

        // --- Strategy A: Exit at Year 3 (Early Exit) ---
        // Valuation at Year 3 is just Stabilization Value
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
        // Endogenous LTV Logic:
        // If Impact Exit is Active: Refi Loan = Dev Debt (repay) + Buyout Amount
        // Buyout Amount = Net Asset Value * (PrivateEquity/TotalEquity) * ImpactExitPct
        let propLoanPrincipal = 0;
        let effectiveLtv = fund.assetLtvStabilized || 0;

        if (fund.impactExitPct > 0) {
            // Calculate Net Asset Value at Stabilization
            const netValStab = totalValueStab - assetDevDebt - fundDebt; // Deducting dev debt and fund debt? Fund debt is usually separate.
            // Assumption: Dev Debt is project level. Fund Debt is fund level. Net Project Value = Val - DevDebt.
            // Wait, standard assumption: We only care about Project Level for this loan.
            const netProjectVal = Math.max(0, totalValueStab - assetDevDebt);

            // Share of Private Equity in this Net Value
            // If fund was 100% equity, Private is (Priv / Total).
            const privShare = totalEquity > 0 ? (fund.privateEquity / totalEquity) : 0;
            const buyoutVal = netProjectVal * privShare * fund.impactExitPct;

            const neededRefi = assetDevDebt + buyoutVal;
            propLoanPrincipal = neededRefi;
            effectiveLtv = totalValueStab > 0 ? propLoanPrincipal / totalValueStab : 0;
        } else {
            propLoanPrincipal = totalValueStab * (fund.assetLtvStabilized || 0);
        }
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
                // TERMINAL VALUE Logic (V2 Upgrade)
                let exitVal = 0;

                // Determine Exit Properties based on Mode
                if (fund.exitValuationMode === 'market-growth') {
                    // Option B: Uplift to Market Rents via Growth
                    // Formula: StabNOI * (1 + MarketGrowth)^HoldYears
                    const hoursHold = t - fund.devYears;
                    const noiMarket = totalNoiStab * Math.pow(1 + wavgMarketGrowth, hoursHold);
                    exitVal = noiMarket / fund.marketCapAfterAffordability;
                } else if (fund.exitValuationMode === 'manual-cap') {
                    // Option C: Manual Exit Cap on Projected (Affordable) NOI
                    const cap = fund.manualExitCap || 0.05;
                    exitVal = noiStream[t] / cap;
                } else if (fund.exitValuationMode === 'two-stage') {
                    // Option D: Legacy Two-Stage (DCF of remaining affordable + Terminal)
                    exitVal = calculateTwoStageExit(
                        noiStream[t],
                        wavgInfl,
                        fund.valuationDiscountRate,
                        fund.holdYears, // years since stab
                        fund.affordableYears, // total affordable duration
                        fund.marketCapAfterAffordability,
                        fund.marketUplift
                    );
                } else {
                    // Option A: No Uplift (0%) or Default
                    // Use Affordable NOI / Market Cap (Reversion)
                    exitVal = noiStream[t] / fund.marketCapAfterAffordability;
                }


                const s = propLoanSched[propLoanSched.length - 1];
                const propLoanBal = s ? s.balance : 0;
                const e = eibSched.find(x => x.period === t);
                const eibBal = e ? e.balance : 0;

                flow += (exitVal - propLoanBal - eibBal);
            }
            return flow;
        });



        // --- Waterfall V2 (Fees + True Waterfall) on Strategy B ---
        // --- 5. FEES (Aligned with Legacy: Base on Equity) ---
        const commonGrossCf = cfEquityB; // Use Strategy B (Hold) as the primary base for waterfall
        const feeBase = totalEquity;
        const feeRate = fund.mgmtFee;

        const poolAfterFees = [...commonGrossCf];
        const feeStream = new Array(totalHorizon + 1).fill(0);

        for (let t = 1; t <= totalHorizon; t++) {
            const annualFee = feeBase * feeRate;
            poolAfterFees[t] -= annualFee;
            feeStream[t] = annualFee;
        }

        // --- 6. PREFERRED EQUITY (Scenario B logic) ---
        let mainWfResult: any = null;
        let prefStream = new Array(totalHorizon + 1).fill(0);
        let cfForCommonWf = [...poolAfterFees];

        if (fund.preferredEquity > 0) {
            const prefRate = fund.preferredRate;
            prefStream[0] = -fund.preferredEquity;

            // Coupon & Principal
            for (let t = 1; t <= totalHorizon; t++) {
                if (t > fund.devYears) prefStream[t] += fund.preferredEquity * prefRate;
                if (t === totalHorizon) prefStream[t] += fund.preferredEquity;
            }

            // Residual logic: Pay Pref from available cash
            cfForCommonWf = poolAfterFees.map((cash, t) => {
                if (t === 0) return -totalEquity; // Common starts with full equity outlay
                const payPref = Math.max(0, prefStream[t]);
                return cash - payPref;
            });
        } else {
            // No Pref: Common WF sees full post-fee pool
            cfForCommonWf[0] = -totalEquity;
        }

        // --- 7. MAIN WATERFALL (Common Equity) ---
        mainWfResult = runWaterfall(
            cfForCommonWf,
            totalEquity,
            fund.hurdleRate,
            fund.promoteRate,
            fund.catchUpRate
        );

        // --- 8. TRANCHE ALLOCATION (First Loss) ---
        // Helper function MUST be defined outside or above. Assuming it exists in file.
        const trancheAlloc = allocateCommonToTranches(
            mainWfResult.lpCash,
            fund.privateEquity,
            fund.eifEquity,
            juniorEquity
        );

        // --- 9. RESULTS ASSEMBLY & SENSITIVITY ---
        const carryStream = mainWfResult.gpCash;
        const lpNetStream = mainWfResult.lpCash;

        const feeTotal = feeStream.reduce((a: number, b: number) => a + b, 0);
        const carryTotal = carryStream.reduce((a: number, b: number) => a + b, 0);

        const irrB = finance.irr(lpNetStream);
        const moicB = lpNetStream.reduce((s: number, x: number) => x > 0 ? s + x : s, 0) / Math.abs(lpNetStream[0] || 1);

        // Sensitivity Analysis - Align with Active Mode
        let baseCap = fund.marketCapAfterAffordability;
        let baseUplift = 1.0;

        if (fund.exitValuationMode === 'manual-cap') {
            baseCap = fund.manualExitCap || 0.05;
            baseUplift = 1.0;
        } else if (fund.exitValuationMode === 'market-growth') {
            // Calculate implied uplift ratio: Market Rent / Affordable Rent
            const hoursHold = fund.holdYears;
            const noiCurrent = noiStream[totalHorizon];
            const noiMarket = totalNoiStab * Math.pow(1 + wavgMarketGrowth, hoursHold);
            // Safety check against zero divisions
            baseUplift = noiCurrent > 0 ? noiMarket / noiCurrent : 1.0;
        } else if (fund.exitValuationMode === 'two-stage') {
            baseUplift = fund.marketUplift;
        }
        // Else 'no-uplift' -> 1.0

        const caps = [baseCap - 0.005, baseCap, baseCap + 0.005];
        const uplifts = [baseUplift - 0.1, baseUplift, baseUplift + 0.1];

        // Needed for sensitivity delta calc:
        const currentExitValB = (cfEquityB[totalHorizon] +
            (propLoanSched[propLoanSched.length - 1]?.balance || 0) +
            (eibSched.find(x => x.period === totalHorizon)?.balance || 0)
        );

        const sensitivityMatrix = caps.map(cap => {
            return uplifts.map(uplift => {
                let sensExitVal = 0;
                if (fund.exitValuationMode === 'two-stage' || fund.valuationMethod === 'two-stage') {
                    sensExitVal = calculateTwoStageExit(
                        noiStream[totalHorizon],
                        wavgInfl,
                        fund.valuationDiscountRate,
                        fund.holdYears,
                        fund.affordableYears,
                        Math.max(0.001, cap),
                        uplift
                    );
                } else {
                    const termNOI = noiStream[totalHorizon];
                    // Standard: NOI * Uplift / Cap
                    sensExitVal = (termNOI * Math.max(0, uplift)) / Math.max(0.001, cap);
                }

                // Delta IRR approx
                const deltaVal = sensExitVal - currentExitValB;
                const sensCf = [...lpNetStream];
                sensCf[totalHorizon] += deltaVal; // Add delta to Net Flow assuming fees/promote dampening is negligible or roughly linear for this check
                const sIrr = finance.irr(sensCf);
                const sMoic = sensCf.reduce((s: number, x: number) => x > 0 ? s + x : s, 0) / Math.abs(sensCf[0] || 1);

                return {
                    cap,
                    uplift,
                    exitVal: sensExitVal,
                    irr: sIrr,
                    moic: sMoic
                };
            });
        });

        // Waterfall Summary (Progression)
        const waterfallSummary = mainWfResult.progression || [];

        // --- 10. RISKS & DETAILS ---
        const dscrArray = timesteps.map(t => {
            if (t <= fund.devYears) return 0; // No DSCR during dev
            const noi = noiStream[t];
            let ds = eibPayment[t] || 0;
            if (t > fund.devYears) {
                const s = propLoanSched.find(x => x.period === (t - fund.devYears));
                if (s) ds += s.payment;
            }
            return ds > 0 ? noi / ds : 99; // 99 as infinity placeholder
        });
        const minDscr = dscrArray.reduce((m: number, v: number, i: number) => (i > fund.devYears && v < m) ? v : m, 99);

        const cashflowsWFB = timesteps.map(t => ({
            year: t,
            gross: commonGrossCf[t],
            fee: feeStream[t],
            netCommon: (commonGrossCf[t] - feeStream[t] - (prefStream[t] > 0 ? prefStream[t] : 0)), // Post-fee, post-pref available for waterfall
            gp: feeStream[t] + carryStream[t],
            lp: lpNetStream[t]
        }));

        // --- Metric Calculation (Gross & CoC) ---
        const grossCommonCF = cfEquityB.map((cf, t) => t === 0 ? -totalEquity : cf); // Using cfEquityB as the base for gross common CF
        const grossCommonIRR = finance.irr(grossCommonCF);

        const grossPos = grossCommonCF.filter((c: number) => c > 0).reduce((a: number, b: number) => a + b, 0);
        const grossNeg = Math.abs(grossCommonCF.filter((c: number) => c < 0).reduce((a: number, b: number) => a + b, 0));
        const grossCommonMOIC = grossNeg > 0 ? grossPos / grossNeg : 0;

        // Avg CoC
        let sumCoC = 0;
        let countCoC = 0;
        for (let t = fund.devYears + 1; t < totalHorizon; t++) { // Exclude Exit Year
            const cf = grossCommonCF[t] || 0;
            sumCoC += (cf / totalEquity); // Using totalEquity as commonEquity
            countCoC++;
        }
        const avgCoC = countCoC > 0 ? sumCoC / countCoC : 0;

        // Yield on Cost (Year 1 Post-Dev)
        const firstOpYearCF = grossCommonCF[fund.devYears + 1] || 0;
        const yieldOnCost = totalEquity > 0 ? firstOpYearCF / totalEquity : 0; // Using totalEquity as commonEquity

        return {
            totalCapital, totalEquity, fundDebt, juniorEquity, baseEquity,
            totalValueStab, totalNoiStab,
            avgCap: totalValueStab > 0 ? totalNoiStab / totalValueStab : 0,
            irrA, moicA,
            irrB, moicB,
            strategies: [
                { id: 'A', name: "Strategy A: Early Exit", desc: "Exit at Stabilization (Gross)", irr: irrA, moic: moicA, profit: (moicA - 1) * totalEquity },
                { id: 'B', name: "Strategy B: Long Hold", desc: `${fund.holdYears}-Year Hold (Net)`, irr: irrB, moic: moicB, profit: (moicB - 1) * totalEquity }
            ],
            timesteps,
            cfEquityB,
            feeTotal,
            carryTotal,
            dscrArray,
            minDscr,
            tranches: trancheAlloc, // Expose at top level for UI
            waterfall: {
                lpNet: lpNetStream,
                gpCash: carryStream,
                founder: timesteps.map(t => feeStream[t] + carryStream[t]),
                tranches: trancheAlloc
            },
            waterfallASummary: waterfallSummary, // Mapping main summary to 'A' prop for UI compatibility or just create generic
            waterfallBSummary: waterfallSummary,
            cashflowsWFB,
            detailedCashflow: cashflowsWFB, // Alias for UI if needed

            exitAudit: {
                exitNoi: noiStream[totalHorizon], // Note: corrected key to exitNoi as per UI usage? Or noiExit? 
                // UI uses: results.exitAudit.noiExit
                noiExit: noiStream[totalHorizon],
                noiMarket: noiStream[totalHorizon] * (1 + wavgInfl) * fund.marketUplift,
                capRate: fund.marketCapAfterAffordability,
                valGross: currentExitValB,
                effectiveLtv: effectiveLtv // Expose calculated LTV
            },
            sensitivityMatrix,
            grossCommonIRR,
            grossCommonMOIC,
            avgCoC,
            yieldOnCost,
            stabilizedNOI: totalNoiStab,
        };
    }, [fund, countries]);

    // --- 1. Define missing metrics in Results interface ---
    // Results interface definition removed (duplicate)

    // --- Legacy Feature 1: Decision Tree Diagram (Mermaid) ---
    const decisionTreeChart = useMemo(() => {
        const { irrA, moicA, irrB, moicB, strategies } = results;
        // Strategy B metrics (unlevered vs levered vs alt)
        // For simplicity, we are showing the weighted average B results from the calculation engine
        // equivalent to "Base loan" case in the python code if fully leveraged.

        return `
        graph TD
            start[<b>Year 0</b><br/>LPs commit €${(results.totalEquity / 1000000).toFixed(0)}M<br/>Fund Debt €${(results.fundDebt / 1000000).toFixed(0)}M]:::box
            y3[<b>End of Year ${fund.devYears}</b><br/>Project Stabilised<br/>Fund owns 95% dev equity]:::oval
            
            subgraph A [Strategy A]
                direction TB
                nodeA[<b>Exit at Year 3</b><br/>IRR: ${(results.irrA * 100).toFixed(1)}%<br/>MOIC: ${results.moicA.toFixed(2)}x]:::action
            end

            subgraph B [Strategy B: Long-Term Hold]
                direction TB
                nodeB[<b>Hold 50 Years</b><br/>IRR: ${(results.irrB * 100).toFixed(1)}%<br/>MOIC: ${results.moicB.toFixed(2)}x]:::action
            end

            start --> y3
            y3 --> nodeA
            y3 --> nodeB

            classDef box fill:#E3F2FD,stroke:#2196F3,stroke-width:2px,color:black,rx:5,ry:5;
            classDef oval fill:#E8F5E9,stroke:#4CAF50,stroke-width:2px,color:black,rx:15,ry:15;
            classDef action fill:#FFF3E0,stroke:#FF9800,stroke-width:2px,color:black,rx:5,ry:5;
        `;
    }, [results]);

    // --- Legacy Feature 2: Excel Export ---
    const handleExport = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary
        const summaryData = [
            ["Metric", "Value"],
            ["Total Capital", results.totalCapital],
            ["Total Equity", results.totalEquity],
            ["Fund Debt", results.fundDebt],
            ["Stabilized Value (Y3)", results.totalValueStab],
            ["Stabilized NOI (Y3)", results.totalNoiStab],
            ["Strategy A IRR", results.irrA],
            ["Strategy A MOIC", results.moicA],
            ["Strategy B IRR", results.irrB],
            ["Strategy B MOIC", results.moicB],
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        // Sheet 2: Countries
        const countryData = countries.map(c => ({
            Country: c.country,
            Weight: c.weight,
            DevIRR: c.devIrr,
            ExitCap: c.exitCap,
            Inflation: c.inflation
        }));
        const wsCountries = XLSX.utils.json_to_sheet(countryData);
        XLSX.utils.book_append_sheet(wb, wsCountries, "Portfolio");

        // Sheet 3: Cash Flows (Strategy B)
        const cfData = results.timesteps.map(t => ({
            Year: t,
            NetCashFlow: results.cfEquityB[t]
        }));
        const wsCF = XLSX.utils.json_to_sheet(cfData);
        XLSX.utils.book_append_sheet(wb, wsCF, "CashFlows_B");

        // Use standard write/download
        XLSX.writeFile(wb, "LegacyFund_Results.xlsx");
    };

    const [debugOpen, setDebugOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        {/* Back button hidden for standalone isolation
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-2 -ml-2 text-slate-500 hover:text-slate-700"
                        >
                            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Modules
                        </Button>
*/}
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-indigo-100">
                                <Building className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                                    Affordable Housing Fund
                                </h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                                        University
                                    </Badge>
                                    <span className="text-sm text-slate-500">Engine: legacy_fund_v1</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Button variant="outline" onClick={() => setDebugOpen((v) => !v)}>
                        <Bug className="h-4 w-4 mr-2" />
                        {debugOpen ? "Hide debug" : "Run debug"}
                    </Button>
                </div>

                {debugOpen && (
                    <Card className="border-slate-200">
                        <CardHeader className="py-3">
                            <CardTitle className="text-sm font-semibold text-slate-800">Debug Panel</CardTitle>
                            <div className="text-xs text-slate-500 mt-1">
                                Inspecting local state and engine inputs.
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="text-xs text-slate-500">Current Inputs</div>
                            <pre className="text-xs p-3 bg-white border rounded-md overflow-auto max-h-64">
                                {JSON.stringify(fund, null, 2)}
                            </pre>
                            <div className="text-xs text-slate-500">Results Summary</div>
                            <pre className="text-xs p-3 bg-white border rounded-md overflow-auto max-h-64">
                                {results ? `Total Equity: ${formatCurrency(results.totalEquity)}\nIRR A: ${formatPercent(results.irrA)}\nIRR B: ${formatPercent(results.irrB)}` : "No results"}
                            </pre>
                        </CardContent>
                    </Card>
                )}

                <p className="text-muted-foreground">
                    Advanced modeling of a pan-European affordable housing fund with EIB leverage, tranche structuring, and multiple exit strategies.
                </p>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 h-auto">
                        <TabsTrigger value="casestudy">0. Case Study</TabsTrigger>
                        <TabsTrigger value="course">1. Fundamentals</TabsTrigger>
                        <TabsTrigger value="structure">2. Structure</TabsTrigger>
                        <TabsTrigger value="portfolio">3. Portfolio</TabsTrigger>
                        <TabsTrigger value="analysis">4. Analysis</TabsTrigger>
                        <TabsTrigger value="decision">5. Decision Tree</TabsTrigger>
                        <TabsTrigger value="report">6. Detailed Report</TabsTrigger>
                        <TabsTrigger value="technical">7. Technical Docs</TabsTrigger>
                    </TabsList>
                    {/* --- TAB 0: FUND MECHANICS COURSE --- */}
                    <TabsContent value="course" className="space-y-6 mt-6">
                        <Card className="bg-white border-slate-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Info className="w-5 h-5 text-indigo-600" />
                                    Fund Management & Design Course
                                </CardTitle>
                                <CardDescription>
                                    Essential concepts before designing your fund structure.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">

                                {/* Module 1: Players */}
                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">1. The Players</h3>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="bg-slate-50 p-4 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">LP</Badge>
                                                <span className="font-semibold">Limited Partner (The Investor)</span>
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                Provides the majority of the capital (90-99%). They are "limited" liability investors who take a passive role.
                                                Their goal is capital preservation and risk-adjusted returns (IRR).
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">GP</Badge>
                                                <span className="font-semibold">General Partner (The Manager)</span>
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                Manages the fund, sources deals, and executes the strategy. They contribute a small amount of capital (1-10%) ("Skin in the game").
                                                Their goal is to earn <b>Fees</b> and <b>Carried Interest</b> (Performance fees).
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Module 2: The Waterfall */}
                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">2. The Distribution Waterfall</h3>
                                    <p className="text-sm text-slate-600 mb-4">
                                        Cash flows are distributed in a strict order of priority. This incentivizes the Manager to perform.
                                    </p>

                                    <div className="relative border-l-2 border-indigo-200 pl-6 space-y-6">
                                        <div className="relative">
                                            <div className="absolute -left-[33px] top-1 bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                                            <h4 className="font-semibold text-sm">Return of Capital</h4>
                                            <p className="text-sm text-slate-500">First, LPs get 100% of their initial investment back. Nobody makes a profit until the principal is safe.</p>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-[33px] top-1 bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                                            <h4 className="font-semibold text-sm">Preferred Return (Hurdle)</h4>
                                            <p className="text-sm text-slate-500">LPs receive a priority return (e.g., 8%) on their money. This guarantees a baseline performance before the Manager shares in profits.</p>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-[33px] top-1 bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                                            <h4 className="font-semibold text-sm text-purple-700">GP Catch-up</h4>
                                            <p className="text-sm text-slate-500">Once LPs hit the Hurdle, the GP needs to "catch up" to their profit share (e.g., 20%). The GP typically gets <b>100% of available cash</b> flow in this tier until the 80/20 split is restored.</p>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-[33px] top-1 bg-amber-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">4</div>
                                            <h4 className="font-semibold text-sm text-amber-600">Carried Interest (Promote)</h4>
                                            <p className="text-sm text-slate-500">Any remaining profit is split (e.g., 80% LP / 20% GP). This 20% is the "Carry" — the Manager's reward for outperformance.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Module 3: Fees */}
                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">3. Fee Structure</h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <Card className="border shadow-sm">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-sm">Management Fee</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-xs text-slate-600">
                                                    Paid annually (e.g., 1-2% of Committed Capital) to cover the Manager's operating expenses (salaries, office, software) regardless of performance.
                                                </p>
                                            </CardContent>
                                        </Card>
                                        <Card className="border shadow-sm">
                                            <CardHeader className="py-3">
                                                <CardTitle className="text-sm">Other Fees</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                                                    <li><b>Acquisition Fee:</b> 0.5% - 1.0% of deal value (paid at closing).</li>
                                                    <li><b>Development Fee:</b> Paid for managing construction.</li>
                                                    <li><b>Setup Fee:</b> Covers fund formation costs (legal).</li>
                                                </ul>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>

                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- TAB 1: STRUCTURE (Inputs) --- */}
                    <TabsContent value="structure" className="space-y-6 mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                            {/* Step 1: Horizon */}
                            <Card className="bg-white border-slate-200">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-slate-900">Step 1 — Horizon</CardTitle>
                                    <div className="text-xs text-slate-500 mt-1">Set development and operating period.</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-700">Development years</Label>
                                        <Input type="number" value={fund.devYears} onChange={e => updateFund('devYears', parseFloat(e.target.value))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-700">Hold years (after dev)</Label>
                                        <Input type="number" value={fund.holdYears} onChange={e => updateFund('holdYears', parseFloat(e.target.value))} />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Step 2: Equity Stack */}
                            <Card className="bg-white border-slate-200">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-slate-900">Step 2 — Equity Stack</CardTitle>
                                    <div className="text-xs text-slate-500 mt-1">Private + EIF + Junior allocation.</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-700">Private Equity (€)</Label>
                                        <Input type="number" step="1000000" value={fund.privateEquity} onChange={e => updateFund('privateEquity', parseFloat(e.target.value))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-700">EIF Equity (€)</Label>
                                        <Input type="number" step="1000000" value={fund.eifEquity} onChange={e => updateFund('eifEquity', parseFloat(e.target.value))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-700">Junior Equity %</Label>
                                        <Input type="number" step="0.01" value={fund.juniorEquityPct} onChange={e => updateFund('juniorEquityPct', parseFloat(e.target.value))} />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Step 3: Fund Leverage */}
                            <Card className="bg-white border-slate-200">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-slate-900">Step 3 — Initial Fund Leverage</CardTitle>
                                    <div className="text-xs text-slate-500 mt-1">Debt at Fund Level (Year 0).</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-700">Lender Debt Share</Label>
                                        <Input type="number" step="0.05" value={fund.fundLeverage} onChange={e => updateFund('fundLeverage', parseFloat(e.target.value))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-700">Interest Rate</Label>
                                        <Input type="number" step="0.001" value={fund.fundDebtRate} onChange={e => updateFund('fundDebtRate', parseFloat(e.target.value))} />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Step 4: Asset Debt (Active) */}
                            <Card className={fund.useAssetDevDebt ? "bg-white border-slate-200" : "bg-white border-slate-200 opacity-60"}>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-slate-900">Step 4 — Asset Dev Debt</CardTitle>
                                    <div className="text-xs text-slate-500 mt-1">Project-level debt during construction.</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Input type="checkbox" className="w-4 h-4" checked={fund.useAssetDevDebt} onChange={e => updateFund('useAssetDevDebt', e.target.checked)} />
                                        <Label className="text-xs text-slate-700">Enable Dev Debt</Label>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-700">LTC (Loan to Cost)</Label>
                                        <Input type="number" step="0.05" disabled={!fund.useAssetDevDebt} value={fund.assetLtc} onChange={e => updateFund('assetLtc', parseFloat(e.target.value))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-700">Interest Rate</Label>
                                        <Input type="number" step="0.001" disabled={!fund.useAssetDevDebt} value={fund.assetDevRate} onChange={e => updateFund('assetDevRate', parseFloat(e.target.value))} />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Step 5: Refinancing & Buyout */}
                            <Card className="bg-white border-slate-200">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-slate-900">Step 5 — Refinancing & Buyout</CardTitle>
                                    <div className="text-xs text-slate-500 mt-1">Post-Dev Public Bank Line.</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-700">Credit Line Rate</Label>
                                        <Input type="number" step="0.001" value={fund.propLoanRate} onChange={e => updateFund('propLoanRate', parseFloat(e.target.value))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-700">Refi LTV (at Year 3)</Label>
                                        <Input
                                            type="number"
                                            step="0.05"
                                            value={fund.impactExitPct > 0 ? (results.exitAudit.effectiveLtv * 100).toFixed(2) : fund.assetLtvStabilized || 0}
                                            disabled={fund.impactExitPct > 0}
                                            onChange={e => updateFund('assetLtvStabilized', parseFloat(e.target.value))}
                                        />
                                        {fund.impactExitPct > 0 && (
                                            <p className="text-[10px] text-blue-600">
                                                Calculated from Buyout ({formatPercent(results.exitAudit.effectiveLtv)})
                                            </p>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 mt-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Input type="checkbox" className="w-4 h-4" checked={fund.impactExitPct > 0} onChange={e => updateFund('impactExitPct', e.target.checked ? 0.5 : 0)} />
                                            <Label className="text-xs text-slate-700">Enable Buyout</Label>
                                        </div>
                                        {fund.impactExitPct > 0 && (
                                            <div className="space-y-1">
                                                <Label className="text-xs text-slate-700">Impact Exit % (of Private)</Label>
                                                {(() => {
                                                    // Strict DSCR Constraint Calculation
                                                    const year4NOI = results.totalNoiStab; // Use Stabilized NOI for DSCR check
                                                    const maxDebtService = year4NOI / 1.10; // Constraint: DSCR >= 1.10
                                                    // Debt Service = (Loan * Rate). So MaxLoan = MaxDebtService / Rate
                                                    const maxTotalLoan = maxDebtService / fund.propLoanRate;

                                                    // Re-calculate Total Capital & Equity for this scope
                                                    const baseEquity = fund.privateEquity + fund.eifEquity;
                                                    const juniorEquity = fund.juniorEquityPct > 0 ? (baseEquity * fund.juniorEquityPct) : 0;
                                                    const totalEquityLocal = baseEquity + juniorEquity;

                                                    let fundDebt = 0;
                                                    if (fund.fundLeverage > 0 && fund.fundLeverage < 1) {
                                                        fundDebt = totalEquityLocal * (fund.fundLeverage / (1 - fund.fundLeverage));
                                                    }
                                                    const totalCapitalLocal = totalEquityLocal + fundDebt;

                                                    // Current Dev Debt (to be refinanced)
                                                    let totalDevCost = fund.useAssetDevDebt ? (totalCapitalLocal / (1 - fund.assetLtc)) : totalCapitalLocal;
                                                    const currentAssetDevDebt = totalDevCost - totalCapitalLocal;

                                                    // Max Buyout = MaxTotalLoan - RepayDevDebt
                                                    const maxBuyoutVal = Math.max(0, maxTotalLoan - currentAssetDevDebt);

                                                    // BuyoutVal = NetProjectVal * PrivShare * ImpactPct
                                                    // So MaxImpactPct = MaxBuyoutVal / (NetProjectVal * PrivShare)
                                                    const netProjectVal = Math.max(0, results.totalValueStab - currentAssetDevDebt);
                                                    const privShare = totalEquityLocal > 0 ? (fund.privateEquity / totalEquityLocal) : 0;

                                                    const maxImpactPct = (netProjectVal * privShare) > 0
                                                        ? (maxBuyoutVal / (netProjectVal * privShare))
                                                        : 0;

                                                    // Clamp display to 2 decimals
                                                    const maxPctDisplay = Math.floor(maxImpactPct * 100) / 100;

                                                    return (
                                                        <>
                                                            <Input
                                                                type="number"
                                                                step="0.05"
                                                                max={maxPctDisplay}
                                                                value={fund.impactExitPct}
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value);
                                                                    // Strict Clamp: Do not let user exceed max
                                                                    if (val <= maxPctDisplay) {
                                                                        updateFund('impactExitPct', val);
                                                                    }
                                                                }}
                                                            />
                                                            <p className="text-[10px] text-orange-600">
                                                                Max: {formatPercent(maxPctDisplay)} (DSCR 1.10x limit)
                                                            </p>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Step 6: Fees & Carry + Preferred */}
                            <Card className="bg-white border-slate-200">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold text-slate-900">Step 6 — Fees & Preferred</CardTitle>
                                    <div className="text-xs text-slate-500 mt-1">Waterfall settings & Preferred equity.</div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-700">Mgmt Fee</Label>
                                            <Input type="number" step="0.001" value={fund.mgmtFee} onChange={e => updateFund('mgmtFee', parseFloat(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-700">Carry Rate</Label>
                                            <Input type="number" step="0.05" value={fund.promoteRate} onChange={e => updateFund('promoteRate', parseFloat(e.target.value))} />
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-100 space-y-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-700">Preferred Equity (€)</Label>
                                            <Input type="number" step="1000000" value={fund.preferredEquity} onChange={e => updateFund('preferredEquity', parseFloat(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-700">Pref Rate</Label>
                                            <Input type="number" step="0.01" value={fund.preferredRate} onChange={e => updateFund('preferredRate', parseFloat(e.target.value))} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Additional Settings (Valuation) */}
                        <Card className="bg-white border-slate-200 mt-4">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold text-slate-900">Exit Valuation Method</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-900">Long-Hold Exit Scenarios (Year {fund.devYears + fund.holdYears})</Label>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-700">Valuation Method</Label>
                                            <select
                                                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                                                value={fund.exitValuationMode}
                                                onChange={e => updateFund('exitValuationMode', e.target.value)}
                                            >
                                                <option value="no-uplift">No Uplift (0% / Affordable Forever)</option>
                                                <option value="market-growth">Market Catch-up (Rent Growth)</option>
                                                <option value="manual-cap">Manual Exit Cap Target</option>
                                                <option value="two-stage">Two-Stage (Affordable Duration)</option>
                                            </select>
                                        </div>

                                        {/* Conditional Inputs */}
                                        {fund.exitValuationMode === 'manual-cap' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs text-slate-700">Target Exit Cap Rate</Label>
                                                <Input type="number" step="0.001" value={fund.manualExitCap} onChange={e => updateFund('manualExitCap', parseFloat(e.target.value))} />
                                            </div>
                                        )}

                                        {fund.exitValuationMode !== 'manual-cap' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs text-slate-700">Market Cap Rate (Reversion)</Label>
                                                <Input type="number" step="0.005" value={fund.marketCapAfterAffordability} onChange={e => updateFund('marketCapAfterAffordability', parseFloat(e.target.value))} />
                                            </div>
                                        )}

                                        {fund.exitValuationMode === 'two-stage' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-slate-700">Affordable Duration (Years)</Label>
                                                    <Input type="number" value={fund.affordableYears} onChange={e => updateFund('affordableYears', parseFloat(e.target.value))} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-slate-700">Disc. Rate (Two-Stage)</Label>
                                                    <Input type="number" step="0.005" value={fund.valuationDiscountRate} onChange={e => updateFund('valuationDiscountRate', parseFloat(e.target.value))} />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 pt-1 space-y-1">
                                        <p>{fund.exitValuationMode === 'no-uplift' && "• Option A (No Uplift): Assumes rents stay affordable indefinitely (inflation only). Value = Affordable NOI / Reversion Cap."}</p>
                                        <p>{fund.exitValuationMode === 'market-growth' && "• Option B (Market Catch-up): Assumes rents revert to market levels at exit. Exit Rent = Stab Rent * (1 + MarketGrowth)^T. Value = Market Rent / Reversion Cap."}</p>
                                        <p>{fund.exitValuationMode === 'manual-cap' && "• Option C (Manual Cap): Valuation based on specific Exit Cap target applied to Affordable NOI."}</p>
                                        <p>{fund.exitValuationMode === 'two-stage' && "• Option D (Two-Stage): Discounted Cash Flow of remaining affordable period + Discounted Terminal Value (calculated at Market Rents)."}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
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
                                            <TableHead className="w-[120px]">Stab. Yield (NOI/Price)</TableHead>
                                            <TableHead className="w-[120px]">CPI</TableHead>
                                            <TableHead className="w-[120px]">Market Rent Growth</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
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
                                                <TableCell>
                                                    <Input
                                                        type="number" step="0.001"
                                                        value={country.marketRentGrowth}
                                                        onChange={e => updateCountry(country.id, 'marketRentGrowth', parseFloat(e.target.value))}
                                                        className="w-20"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => removeCountry(country.id)}>
                                                        <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-500" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <div className="mt-4 flex justify-end">
                                    <Button variant="outline" size="sm" onClick={addCountry} className="flex items-center gap-2">
                                        <Plus className="w-4 h-4" />
                                        Add Country
                                    </Button>
                                </div>

                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- TAB 3: ANALYSIS (Results) --- */}
                    <TabsContent value="analysis" className="space-y-6 mt-6">

                        {/* Fund Narrative (Base44 Port) */}
                        <Card className="border-slate-200">
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm font-semibold text-slate-800">
                                    Fund narrative — how to read Steps 5–8
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 pb-4 text-sm text-slate-700 space-y-2 leading-snug">
                                <p>
                                    The Legacy Fund deploys <b>Common equity</b> (Private + EIF + optional Junior) and <b>EIB fund debt</b> into a pan-European affordable housing strategy.
                                    Development capital is rolled into stabilized assets that generate <b>affordable NOI</b>, grown by country-specific inflation.
                                </p>
                                <p>
                                    <b>Case A — Waterfall A</b>: no preferred equity. Common equity shares net cashflows after fees/carry. Junior absorbs first losses.
                                </p>
                                <p>
                                    <b>Case B — Waterfall B</b>: preferred equity sits above common. Preferred receives coupon + principal first; the residual goes to the common waterfall.
                                </p>
                                <div className="mt-4 p-3 bg-slate-50 rounded-md">
                                    <p className="font-semibold text-xs uppercase text-slate-500 mb-1">Key Definitions</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li><b>NOI:</b> Stabilized net operating income from the rental portfolio.</li>
                                        <li><b>Distributable to Equity:</b> Cash remaining after paying fund-level debt service (EIB).</li>
                                        <li><b>Two-Stage Exit:</b> Valuation method separating affordable period cashflows from market reversion value.</li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Consoldiated Financial Metrics */}
                        <Card className="border-slate-200">
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm font-semibold text-slate-800">
                                    Step 5 — Financial Metrics & Results (Gross)
                                </CardTitle>
                                <div className="text-sm text-slate-500 mt-1 leading-snug">
                                    Key performance indicators for the fund strategy.
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0 pb-4 space-y-3">
                                {/* 1. IRR (Common, Gross) */}
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-bold text-sm text-slate-900">1. IRR (Common, Gross, Years 1-{fund.devYears + fund.holdYears})</h3>
                                        <span className="font-mono font-bold text-emerald-700">{formatPercent(results.grossCommonIRR)}</span>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        Total return on equity before fees/carry. Driven by leveraged development and market exit.
                                    </p>
                                </div>

                                {/* 2. Nominal IRR (Net LP) */}
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-bold text-sm text-slate-900">2. Nominal IRR (Net LP, Years 1-{fund.devYears + fund.holdYears})</h3>
                                        <span className="font-mono font-bold text-blue-700">{formatPercent(results.irrB)}</span>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        Actual LP return after 2% management fee and 20% carry.
                                    </p>
                                </div>

                                {/* 3. Avg Exit Cap Rate */}
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-bold text-sm text-slate-900">3. Avg Exit Cap Rate</h3>
                                        <span className="font-mono font-bold text-slate-900">{formatPercent(results.avgCap)}</span>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        Weighted average stabilized cap rate across all countries (Portfolio yield).
                                    </p>
                                </div>

                                {/* 4. Avg CoC (Gross) */}
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-bold text-sm text-slate-900">4. Avg CoC (Gross)</h3>
                                        <span className="font-mono font-bold text-slate-900">{formatPercent(results.avgCoC)}</span>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        Average annual cash yield during operating years (excluding exit).
                                    </p>
                                </div>

                                {/* 5. CoC (Year 1 Post-Dev, Gross) */}
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-bold text-sm text-slate-900">5. CoC (Year 1 Post-Dev, Gross)</h3>
                                        <span className="font-mono font-bold text-slate-900">{formatPercent(results.yieldOnCost)}</span>
                                    </div>
                                    <p className="text-xs text-slate-600">
                                        Cash yield in the first operating year (Year {fund.devYears + 1}). Negative if high debt service.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Explainer: How Debt Works */}
                        <Card className="border-slate-200">
                            <CardHeader className="py-3">
                                <CardTitle className="text-sm font-semibold text-slate-800">How debt works in this model</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 pb-4 text-sm text-slate-700 space-y-2 leading-snug">
                                <p>
                                    <b>EIB Payment</b> is paid at the fund level (interest-only during development, then amortising during hold). After paying EIB, the remaining cash is what equity can potentially receive.
                                </p>
                                <p>
                                    <b>DSCR</b> shows coverage: DSCR = NOI / Debt Service. We target DSCR &gt; 1.20x for healthy operations.
                                </p>
                            </CardContent>
                        </Card>

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
                                                <TableHead className="text-right" title="Net benefit to LPs after fees and carry">Nominal IRR (Net LP)</TableHead>
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

                            {/* --- DSCR / RISK ANALYSIS (V2) --- */}
                            <Card className="lg:col-span-1">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <AlertCircle className={results.minDscr < 1.20 ? "text-red-500" : "text-green-500"} />
                                        Risk Analysis (DSCR)
                                    </CardTitle>
                                    <CardDescription>Debt Service Coverage Ratio (Target &gt; 1.20x)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="mb-4">
                                        <div className="text-3xl font-bold flex items-end gap-2">
                                            {results.minDscr.toFixed(2)}x
                                            <span className="text-sm font-normal text-muted-foreground mb-1">Min Coverage</span>
                                        </div>
                                        {results.minDscr < 1.0 && (
                                            <div className="text-xs text-red-500 font-bold mt-1">
                                                ⚠️ CRITICAL: Cash Trap / Default Risk
                                            </div>
                                        )}
                                        {results.minDscr >= 1.0 && results.minDscr < 1.25 && (
                                            <div className="text-xs text-orange-500 font-bold mt-1">
                                                ⚠️ Warning: Low Coverage
                                            </div>
                                        )}
                                        {results.minDscr >= 1.25 && (
                                            <div className="text-xs text-green-600 font-bold mt-1">
                                                ✓ Healthy Coverage
                                            </div>
                                        )}
                                    </div>
                                    <div className="h-[200px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={
                                                results.dscrArray.map((d: number, i: number) => ({ year: i, dscr: d === 999 ? null : d }))
                                                    .filter((item: any) => item.year > fund.devYears)
                                            }>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                                                <YAxis domain={[0, 'auto']} tick={{ fontSize: 12 }} />
                                                <RechartsTooltip />
                                                <Line type="monotone" dataKey="dscr" stroke="#ef4444" strokeWidth={2} dot={false} name="DSCR" />
                                                {/* Breakeven Line */}
                                                <Line type="monotone" dataKey={() => 1.0} stroke="#000" strokeDasharray="3 3" strokeWidth={1} dot={false} name="Breakeven (1.0x)" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* --- TRANCHE ALLOCATION (V2 - First Loss) --- */}
                            <Card className="lg:col-span-1">
                                <CardHeader>
                                    <CardTitle>Equity Tranche Returns</CardTitle>
                                    <CardDescription>
                                        Allocation of Net Cashflows (First Loss Protocol)
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tranche</TableHead>
                                                <TableHead className="text-right">Invested</TableHead>
                                                <TableHead className="text-right">IRR</TableHead>
                                                <TableHead className="text-right">MOIC</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell className="font-medium text-blue-600">Private LP (Senior)</TableCell>
                                                <TableCell className="text-right">{formatCurrency(fund.privateEquity)}</TableCell>
                                                <TableCell className="text-right font-bold">
                                                    {formatPercent(finance.irr(results.tranches.privateCf))}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {(results.tranches.privateCf.reduce((a: number, b: number) => a + (b > 0 ? b : 0), 0) / Math.abs(results.tranches.privateCf[0])).toFixed(2)}x
                                                </TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="font-medium text-emerald-600">EIF (Pari-Passu)</TableCell>
                                                <TableCell className="text-right">{formatCurrency(fund.eifEquity)}</TableCell>
                                                <TableCell className="text-right font-bold">
                                                    {formatPercent(finance.irr(results.tranches.eifCf))}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {(results.tranches.eifCf.reduce((a: number, b: number) => a + (b > 0 ? b : 0), 0) / Math.abs(results.tranches.eifCf[0])).toFixed(2)}x
                                                </TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="font-medium text-amber-600">Junior (First Loss)</TableCell>
                                                <TableCell className="text-right">{formatCurrency(results.juniorEquity)}</TableCell>
                                                <TableCell className="text-right font-bold">
                                                    {formatPercent(finance.irr(results.tranches.juniorCf))}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {(results.tranches.juniorCf.reduce((a: number, b: number) => a + (b > 0 ? b : 0), 0) / Math.abs(results.tranches.juniorCf[0] || 1)).toFixed(2)}x
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            {/* --- WATERFALL DISTRIBUTION (V2) --- */}
                            {/* --- ANNUAL CASHFLOW CHART (Moved Up) --- */}
                            <Card className="lg:col-span-2">
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
                                                <RechartsTooltip formatter={(val: number | undefined) => formatCurrency(val ?? 0)} />
                                                <Bar dataKey="flow" fill="hsl(var(--primary))" name="Equity Net Cash Flow" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* --- WATERFALL DISTRIBUTION (V2) --- */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-blue-500" />
                                        Profit Distribution (Waterfall)
                                    </CardTitle>
                                    <CardDescription>LP Net vs. Founder (Fees + Promote)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="p-3 bg-blue-50/50 rounded-lg">
                                            <div className="text-xs text-muted-foreground uppercase">LP Net Profit</div>
                                            <div className="text-lg font-bold text-blue-700">
                                                {formatCurrency(results.waterfall.lpNet.reduce((a: number, b: number) => a + (b > 0 ? b : 0), 0) - results.totalEquity)}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-purple-50/50 rounded-lg">
                                            <div className="text-xs text-muted-foreground uppercase">Founder Comp</div>
                                            <div className="text-lg font-bold text-purple-700">
                                                {formatCurrency(results.feeTotal + results.carryTotal)}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                ({formatCurrency(results.feeTotal)} Fees + {formatCurrency(results.carryTotal)} Carry)
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-[200px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={
                                                results.timesteps.map(t => ({
                                                    year: t,
                                                    lp: results.waterfall.lpNet[t] > 0 ? results.waterfall.lpNet[t] : 0,
                                                    founder: results.waterfall.founder[t] > 0 ? results.waterfall.founder[t] : 0
                                                })).filter(d => d.lp > 0 || d.founder > 0)
                                            }>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                                                <RechartsTooltip formatter={(v: number | undefined) => formatCurrency(v ?? 0)} />
                                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                                <Bar dataKey="lp" stackId="a" fill="#3b82f6" name="LP Net Cash" />
                                                <Bar dataKey="founder" stackId="a" fill="#a855f7" name="Founder (Fee+Carry)" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Waterfall Tables */}
                                    <div className="mt-8 space-y-6">
                                        {/* Waterfall Definitions & Logic */}
                                        <div className="bg-slate-50 p-4 rounded-lg border text-sm space-y-3 mb-4">
                                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                                                <Info className="w-4 h-4 text-blue-600" />
                                                Waterfall Terms & Dynamics
                                            </div>
                                            <div className="grid md:grid-cols-3 gap-4">
                                                <div>
                                                    <span className="font-semibold text-green-700">1. Preferred (Hurdle)</span>
                                                    <p className="text-slate-600 text-xs mt-1">
                                                        Priority return ({formatPercent(fund.hurdleRate)}) owed to <b>LP Investors</b> on their unreturned capital. Accrues annually.
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-purple-700">2. Catch-up</span>
                                                    <p className="text-slate-600 text-xs mt-1">
                                                        Allocated to the <b>Fund Manager (GP)</b>. Once Investors receive their Hurdle, the Manager receives <b>100% of available cash flow</b> until their total profits catch up to the agreed split ({formatPercent(fund.promoteRate)} of total distributed profits).
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-amber-600">3. Carry (Promote)</span>
                                                    <p className="text-slate-600 text-xs mt-1">
                                                        The <b>Manager's (GP)</b> performance fee ({formatPercent(fund.promoteRate)}) on all remaining "Residual" profits after the Catch-up is complete.
                                                    </p>
                                                </div>
                                            </div>

                                            {(() => {
                                                const wf = results.waterfallBSummary.length > 0 ? results.waterfallBSummary : results.waterfallASummary;
                                                const firstHurdle = wf.find((r: any) => r.paidHurdle > 1000); // threshold to avoid rounding noise
                                                if (firstHurdle && firstHurdle.year > 1) {
                                                    return (
                                                        <div className="mt-2 pt-2 border-t border-slate-200 text-slate-500 italic text-xs">
                                                            <span className="font-semibold text-slate-700">Why Year {firstHurdle.year}? </span>
                                                            In this specific scenario (based on your inputs), early cash flows (Years 1-{firstHurdle.year - 1}) are fully allocated to <b>Return of Capital (LP)</b>.
                                                            The <b>Preferred (Hurdle)</b> only begins paying out once the initial invested capital has been significantly repaid.
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-semibold mb-2">Waterfall B: Common Equity Distribution (Summary)</h4>
                                            <div className="overflow-x-auto border rounded-lg">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-[80px]">Year</TableHead>
                                                            <TableHead className="text-right">Cash Avail</TableHead>
                                                            <TableHead className="text-right text-blue-700" title="To Limited Partners">Return of Cap (LP)</TableHead>
                                                            <TableHead className="text-right text-green-700" title="To Limited Partners">Preferred (LP)</TableHead>
                                                            <TableHead className="text-right text-purple-700" title="To General Partner">Catch-up (GP)</TableHead>
                                                            <TableHead className="text-right text-amber-700" title="To General Partner">Carry (GP)</TableHead>
                                                            <TableHead className="text-right text-slate-700">Residual (Split)</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {(results.waterfallBSummary.length > 0 ? results.waterfallBSummary : results.waterfallASummary).map((row: any, i: number) => (
                                                            <TableRow key={i}>
                                                                <TableCell>{row.year}</TableCell>
                                                                <TableCell className="text-right font-mono">{formatCurrency(row.cashAvailable)}</TableCell>
                                                                <TableCell className="text-right font-mono text-blue-600">{formatCurrency(row.paidRoc)}</TableCell>
                                                                <TableCell className="text-right font-mono text-green-600">{formatCurrency(row.paidHurdle)}</TableCell>
                                                                <TableCell className="text-right font-mono text-purple-600">{formatCurrency(row.paidCatchup)}</TableCell>
                                                                <TableCell className="text-right font-mono text-amber-600">{formatCurrency(row.paidPromote)}</TableCell>
                                                                <TableCell className="text-right font-mono font-bold">{formatCurrency(row.paidResidual)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>

                                        {fund.preferredEquity > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold mb-2">Waterfall B: Cashflow Detail (Preferred + Common)</h4>
                                                <div className="overflow-x-auto border rounded-lg">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-[80px]">Year</TableHead>
                                                                <TableHead className="text-right">Preferred Payout</TableHead>
                                                                <TableHead className="text-right">Common Net</TableHead>
                                                                <TableHead className="text-right">Founder (Fees+Carry)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {results.cashflowsWFB.map((row: any, i: number) => (
                                                                <TableRow key={i}>
                                                                    <TableCell>{row.year}</TableCell>
                                                                    <TableCell className="text-right font-mono text-amber-600">{formatCurrency(Math.max(0, row.prefCf))}</TableCell>
                                                                    <TableCell className="text-right font-mono text-blue-600">{formatCurrency(row.commonNet)}</TableCell>
                                                                    <TableCell className="text-right font-mono text-purple-600">{formatCurrency(row.founderVal)}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </CardContent>
                            </Card>


                            <Card className="lg:col-span-2">
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

                            {/* --- SENSITIVITY ANALYSIS (Phase 3) --- */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Calculator className="w-5 h-5 text-orange-500" />
                                        Sensitivity Analysis (Net IRR - Strategy B)
                                    </CardTitle>
                                    <CardDescription>Impact of Exit Cap Rate (Rows) vs. Market Rent Uplift (Cols)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Exit Cap \ Uplift</TableHead>
                                                {[fund.marketUplift - 0.1, fund.marketUplift, fund.marketUplift + 0.1].map((u, i) => (
                                                    <TableHead key={i} className="text-center font-bold">
                                                        {((u) * 100).toFixed(0)}%
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {results.sensitivityMatrix.map((row, rIndex) => (
                                                <TableRow key={rIndex}>
                                                    <TableCell className="font-bold border-r">
                                                        {((row[0].cap) * 100).toFixed(2)}%
                                                    </TableCell>
                                                    {row.map((cell, cIndex) => (
                                                        <TableCell key={cIndex} className="text-center">
                                                            <span className={cell.irr > 0.10 ? "text-green-600 font-bold" : (cell.irr < 0.05 ? "text-red-500" : "")}>
                                                                {formatPercent(cell.irr)}
                                                            </span>
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                    <TabsContent value="decision" className="space-y-6 mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Decision Tree (Waterfall A)</CardTitle>
                                <CardDescription>
                                    Visualizing the decision paths for Limited Partners (LPs).
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                <div className="border rounded-lg p-4 bg-muted/20">
                                    <MermaidChart chart={decisionTreeChart} />
                                </div>
                                <div className="mt-8 flex justify-end">
                                    <Button onClick={handleExport} className="gap-2">
                                        <Calculator className="w-4 h-4" />
                                        Export Results to Excel
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>


                    {/* --- TAB 5: DETAILED REPORT --- */}
                    <TabsContent value="report" className="space-y-6 mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calculator className="w-5 h-5" />
                                    Detailed Annual Cash Flows
                                </CardTitle>
                                <CardDescription>
                                    Annual breakdown of cash flows, fees, and distributions.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Year</TableHead>
                                                <TableHead>Gross CF (Strategy B)</TableHead>
                                                <TableHead>Fees</TableHead>
                                                <TableHead>Net to Common</TableHead>
                                                <TableHead>Founder (Fee+Carry)</TableHead>
                                                <TableHead>LP Net Cash</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {results.detailedCashflow.map((cf) => (
                                                <TableRow key={cf.year}>
                                                    <TableCell className="font-mono">{cf.year}</TableCell>
                                                    <TableCell className="font-mono">{formatCurrency(cf.gross)}</TableCell>
                                                    <TableCell className="font-mono text-red-500">({formatCurrency(cf.fee)})</TableCell>
                                                    <TableCell className="font-mono font-bold">{formatCurrency(cf.netCommon)}</TableCell>
                                                    <TableCell className="font-mono text-purple-600">{formatCurrency(cf.gp)}</TableCell>
                                                    <TableCell className="font-mono text-blue-600 font-bold">{formatCurrency(cf.lp)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="mt-8 border-t pt-6">
                                    <h4 className="font-semibold mb-4">Exit Valuation Audit (Terminal Value)</h4>
                                    <Table>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell>NOI at Exit (Year {fund.holdYears + fund.devYears})</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(results.exitAudit.noiExit)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Market NOI (incl. Uplift {((fund.marketUplift - 1) * 100).toFixed(0)}%)</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(results.exitAudit.noiMarket)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>Market Cap Rate</TableCell>
                                                <TableCell className="text-right font-mono">{(results.exitAudit.capRate * 100).toFixed(2)}%</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="font-bold">Gross Terminal Value</TableCell>
                                                <TableCell className="text-right font-mono font-bold text-lg">{formatCurrency(results.exitAudit.valGross)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- TAB 0: CASE STUDY (STORY-BASED) --- */}
                    <TabsContent value="casestudy" className="space-y-6 mt-6">
                        {/* Hero Introduction */}
                        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-2xl">
                            <CardHeader>
                                <CardTitle className="text-3xl">Case Study: Building the €700M Pan-European Housing Fund</CardTitle>
                                <CardDescription className="text-slate-300 text-lg">
                                    Follow Sofia Martinez's journey from discovering a crisis to architecting a solution
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-start gap-6 mb-6">
                                    <div className="w-24 h-24 bg-secondary/20 rounded-full flex items-center justify-center text-4xl">
                                        👩‍💼
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-bold text-secondary mb-2">Meet Sofia Martinez</h3>
                                        <p className="text-slate-200 text-base leading-relaxed">
                                            Senior Investment Analyst at <strong>Europa Capital Partners</strong>, Brussels.
                                            8 years in European real estate PE. Known for finding alpha in overlooked markets.
                                        </p>
                                        <div className="mt-4 grid grid-cols-3 gap-4">
                                            <div className="bg-white/10 p-3 rounded-lg border border-white/20">
                                                <div className="text-sm text-slate-400">Education</div>
                                                <div className="text-base font-semibold">MIT Economics</div>
                                            </div>
                                            <div className="bg-white/10 p-3 rounded-lg border border-white/20">
                                                <div className="text-sm text-slate-400">Specialty</div>
                                                <div className="text-base font-semibold">Distressed Assets</div>
                                            </div>
                                            <div className="bg-white/10 p-3 rounded-lg border border-white/20">
                                                <div className="text-sm text-slate-400">Track Record</div>
                                                <div className="text-base font-semibold">18% Avg IRR</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-900/30 border-l-4 border-secondary p-4 rounded-r-lg">
                                    <p className="text-sm text-slate-300 italic">
                                        "Everyone said affordable housing can't generate institutional returns. I was determined to prove them wrong."
                                        <span className="block text-right mt-2 not-italic text-secondary font-semibold">— Sofia Martinez, March 2024</span>
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Timeline */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-secondary" />
                                    The 12-Month Journey: Q1 2023 → Q1 2024
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="relative">
                                    <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-secondary via-blue-500 to-green-500"></div>
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-4">
                                            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center text-white font-bold z-10 text-sm">Mar '23</div>
                                            <div className="flex-1 pt-2">
                                                <div className="font-semibold text-lg">Discovery</div>
                                                <div className="text-sm text-muted-foreground">32M households paying &gt;30% income on rent</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold z-10 text-sm">Jun '23</div>
                                            <div className="flex-1 pt-2">
                                                <div className="font-semibold text-lg">Analysis</div>
                                                <div className="text-sm text-muted-foreground">Built 28-country opportunity matrix</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold z-10 text-sm">Sep '23</div>
                                            <div className="flex-1 pt-2">
                                                <div className="font-semibold text-lg">Breakthrough</div>
                                                <div className="text-sm text-muted-foreground">3-phase model + EIF/EIB partnership unlocks 11% IRR</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold z-10 text-sm">Dec '23</div>
                                            <div className="flex-1 pt-2">
                                                <div className="font-semibold text-lg">Structuring</div>
                                                <div className="text-sm text-muted-foreground">Designed waterfall with hurdle rate & promote</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-white font-bold z-10 text-sm">Mar '24</div>
                                            <div className="flex-1 pt-2">
                                                <div className="font-semibold text-lg">Success!</div>
                                                <div className="text-sm text-muted-foreground">IC approval: €700M first close achieved</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Story Chapters */}
                        <Accordion type="single" collapsible defaultValue="chapter1" className="w-full space-y-4">
                            {/* Chapter 1 */}
                            <AccordionItem value="chapter1" className="border rounded-lg px-2">
                                <AccordionTrigger className="px-4 hover:no-underline">
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center text-secondary font-bold text-lg">1</div>
                                        <div>
                                            <div className="font-bold text-lg">The Discovery</div>
                                            <div className="text-sm text-muted-foreground font-normal">Brussels, March 2023 • A €2 trillion problem...</div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6 pt-4 space-y-6">
                                    <p className="text-base leading-relaxed">
                                        <strong>Monday, March 13, 2023</strong> — Sofia's coffee grew cold as she stared at the Eurostat report.
                                        One statistic jumped off the screen: <span className="font-bold text-red-600">32 million households</span> across
                                        EU-27 + UK spending more than 30% of income on housing.
                                    </p>

                                    <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-lg">
                                        <div className="flex items-start gap-4">
                                            <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
                                            <div>
                                                <div className="font-bold text-2xl text-red-900 mb-2">The Crisis</div>
                                                <p className="text-red-800 mb-3">
                                                    Netherlands: <strong>41%</strong> of income on rent<br />
                                                    Sweden: <strong>38%</strong><br />
                                                    Spain: <strong>35%</strong>
                                                </p>
                                                <div className="font-bold text-red-900 text-3xl">€2.0 Trillion</div>
                                                <div className="text-sm text-red-700">Total European housing deficit</div>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-base leading-relaxed italic text-slate-600">
                                        "A €2 trillion problem is a €2 trillion opportunity," Sofia thought. But could "affordable" housing—
                                        rents capped at 30% of median income—generate the 12-15% IRRs her LPs demanded?
                                    </p>

                                    <Card className="bg-slate-50 border-2 border-slate-300">
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Lightbulb className="w-5 h-5 text-amber-600" />
                                                Initial Hypothesis (March 2023)
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3 text-sm">
                                            <div className="flex gap-3">
                                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                                <div><strong>Supply shortage:</strong> Governments can't build fast enough</div>
                                            </div>
                                            <div className="flex gap-3">
                                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                                <div><strong>Inflation hedge:</strong> CPI-indexed rents protect real returns</div>
                                            </div>
                                            <div className="flex gap-3">
                                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                                <div><strong>Structural demand:</strong> 32M households = low vacancy risk</div>
                                            </div>
                                            <div className="flex gap-3">
                                                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                                <div><strong>Challenge:</strong> How to make "affordable" = "profitable"?</div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </AccordionContent>
                            </AccordionItem>

                            {/* Chapter 2 */}
                            <AccordionItem value="chapter2" className="border rounded-lg px-2">
                                <AccordionTrigger className="px-4 hover:no-underline">
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-700 font-bold text-lg">2</div>
                                        <div>
                                            <div className="font-bold text-lg">The Deep Dive</div>
                                            <div className="text-sm text-muted-foreground font-normal">April-June 2023 • Mapping 28 European markets...</div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6 pt-4 space-y-6">
                                    <p className="text-base">
                                        Sofia spent 12 weeks building the "Housing Opportunity Matrix"—scoring 28 countries across 6 dimensions:
                                    </p>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="bg-purple-50 p-3 rounded border border-purple-200 text-sm">
                                            <div className="font-semibold text-purple-900">📊 Affordability Stress</div>
                                            <div className="text-xs text-purple-700">% cost-burdened</div>
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm">
                                            <div className="font-semibold text-blue-900">🏗️ Construction Pipeline</div>
                                            <div className="text-xs text-blue-700">Units per 1K pop</div>
                                        </div>
                                        <div className="bg-green-50 p-3 rounded border border-green-200 text-sm">
                                            <div className="font-semibold text-green-900">💰 Rental Yield</div>
                                            <div className="text-xs text-green-700">NOI / Asset Value</div>
                                        </div>
                                        <div className="bg-amber-50 p-3 rounded border border-amber-200 text-sm">
                                            <div className="font-semibold text-amber-900">⚖️ Regulatory Risk</div>
                                            <div className="text-xs text-amber-700">Rent control index</div>
                                        </div>
                                        <div className="bg-red-50 p-3 rounded border border-red-200 text-sm">
                                            <div className="font-semibold text-red-900">📈 GDP Growth</div>
                                            <div className="text-xs text-red-700">10-yr forecast</div>
                                        </div>
                                        <div className="bg-indigo-50 p-3 rounded border border-indigo-200 text-sm">
                                            <div className="font-semibold text-indigo-900">🛡️ Political Stability</div>
                                            <div className="text-xs text-indigo-700">Democracy index</div>
                                        </div>
                                    </div>

                                    <Card className="border-2 border-secondary">
                                        <CardHeader>
                                            <CardTitle className="text-base">Sofia's Final 7-Country Portfolio (June 2023)</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-100">
                                                        <TableHead className="font-bold">Country</TableHead>
                                                        <TableHead className="text-center font-bold">Weight</TableHead>
                                                        <TableHead className="font-bold">Strategic Rationale</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    <TableRow>
                                                        <TableCell className="font-semibold">🇸🇪 Sweden</TableCell>
                                                        <TableCell className="text-center"><span className="px-3 py-1 bg-secondary/20 font-bold rounded">27%</span></TableCell>
                                                        <TableCell className="text-sm">Primary anchor · Low volatility</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="font-semibold">🇵🇱 Poland</TableCell>
                                                        <TableCell className="text-center"><span className="px-3 py-1 bg-secondary/20 font-bold rounded">17%</span></TableCell>
                                                        <TableCell className="text-sm">High-growth CEE leader</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="font-semibold">🇫🇷 France</TableCell>
                                                        <TableCell className="text-center"><span className="px-3 py-1 bg-secondary/20 font-bold rounded">11%</span></TableCell>
                                                        <TableCell className="text-sm">Core institutional market</TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell className="font-semibold">3 Others</TableCell>
                                                        <TableCell className="text-center"><span className="px-3 py-1 bg-secondary/20 font-bold rounded">30%</span></TableCell>
                                                        <TableCell className="text-sm">Spain, Netherlands, Czech, Hungary</TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                            <div className="mt-4 bg-green-50 border border-green-200 p-3 rounded text-sm">
                                                <TrendingUp className="w-5 h-5 text-green-600 inline mr-2" />
                                                <strong className="text-green-900">Backtest (2013-2024):</strong>
                                                <span className="text-green-700"> 11.1% annual return, 2.94 Sharpe, 3.1% volatility</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </AccordionContent>
                            </AccordionItem>

                            {/* Chapter 3 */}
                            <AccordionItem value="chapter3" className="border rounded-lg px-2">
                                <AccordionTrigger className="px-4 hover:no-underline">
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">3</div>
                                        <div>
                                            <div className="font-bold text-lg">The Breakthrough</div>
                                            <div className="text-sm text-muted-foreground font-normal">September 2023 • The 3-phase model...</div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6 pt-4 space-y-6">
                                    <p className="text-base">
                                        The eureka moment came on a Friday afternoon: <strong>What if we separate development returns from hold period returns?</strong>
                                    </p>

                                    <div className="grid md:grid-cols-3 gap-4">
                                        <Card className="border-2 border-secondary">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base">Phase 1: Development</CardTitle>
                                                <div className="text-xs text-muted-foreground">Years 0-3</div>
                                            </CardHeader>
                                            <CardContent className="text-sm space-y-2">
                                                <div>• Build at cost</div>
                                                <div>• Target <strong>8-15% unlevered IRR</strong></div>
                                                <div>• Use property dev loans (70% LTC)</div>
                                                <div className="font-bold text-green-700">= Construction Alpha</div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-2 border-blue-500">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base">Phase 2: Stabilization</CardTitle>
                                                <div className="text-xs text-muted-foreground">Year 3-4</div>
                                            </CardHeader>
                                            <CardContent className="text-sm space-y-2">
                                                <div>• Lease-up to 95%</div>
                                                <div>• ESG certifications</div>
                                                <div>• Refinance prop debt</div>
                                                <div className="font-bold text-blue-700">= De-risk Asset</div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-2 border-indigo-500">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base">Phase 3: Hold</CardTitle>
                                                <div className="text-xs text-muted-foreground">Years 4-23</div>
                                            </CardHeader>
                                            <CardContent className="text-sm space-y-2">
                                                <div>• CPI-indexed rents</div>
                                                <div>• Low capex (new buildings)</div>
                                                <div>• Stable 4-5% yields</div>
                                                <div className="font-bold text-indigo-700">= Inflation Hedge</div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="bg-secondary/10 border-l-4 border-secondary p-4 rounded-r">
                                        <div className="font-bold mb-2">💡 The EIF/EIB Insight</div>
                                        <p className="text-sm">
                                            Sofia realized: <strong>Partner with European Investment Fund (EIF) + European Investment Bank (EIB)</strong> for:
                                        </p>
                                        <ul className="text-sm mt-2 space-y-1">
                                            <li>• <strong>EIF</strong>: 20-30% anchor equity (pari passu with LPs)</li>
                                            <li>• <strong>EIB</strong>: 50% LTV forward financing at ~1.5-2.0% for 15-20 years</li>
                                            <li>• = Institutional credibility + deeply subsidized leverage</li>
                                        </ul>
                                    </div>

                                    <div className="bg-green-50 border border-green-200 p-4 rounded">
                                        <div className="font-bold text-lg text-green-900 mb-2">First IRR Calculation: September 15, 2023</div>
                                        <div className="text-sm text-green-800">
                                            Running the numbers with EIB leverage + 3-phase model:<br />
                                            <span className="font-bold text-2xl text-green-700">11.3% Net LP IRR</span> (after fees)
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            {/* Chapter 4 */}
                            <AccordionItem value="chapter4" className="border rounded-lg px-2">
                                <AccordionTrigger className="px-4 hover:no-underline">
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="w-12 h-12 bg-indigo-600/20 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg">4</div>
                                        <div>
                                            <div className="font-bold text-lg">The Structuring</div>
                                            <div className="text-sm text-muted-foreground font-normal">October-December 2023 • Designing the waterfall...</div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6 pt-4 space-y-6">
                                    <p className="text-base">
                                        Now came the hard part: <strong>How to split the returns?</strong> Sofia needed a structure that would attract
                                        institutional LPs, impact investors, AND align the GP.
                                    </p>

                                    <Card className="border-2 border-indigo-500">
                                        <CardHeader>
                                            <CardTitle className="text-base">European Waterfall Design</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3 text-sm">
                                            <div className="flex gap-3 items-start">
                                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-700">1</div>
                                                <div>
                                                    <div className="font-semibold">Return of Capital</div>
                                                    <div className="text-muted-foreground">LPs get 100% until capital returned</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 items-start">
                                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-700">2</div>
                                                <div>
                                                    <div className="font-semibold">Preferred Return (Hurdle)</div>
                                                    <div className="text-muted-foreground">8% annualized on outstanding capital → 100% to LPs</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 items-start">
                                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-700">3</div>
                                                <div>
                                                    <div className="font-semibold">GP Catch-Up</div>
                                                    <div className="text-muted-foreground">100% to GP until they've earned 20% of total profit</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-3 items-start">
                                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center font-bold text-indigo-700">4</div>
                                                <div>
                                                    <div className="font-semibold">Promote Split</div>
                                                    <div className="text-muted-foreground">80% LP / 20% GP on residual</div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-amber-50 border-2 border-amber-300">
                                        <CardHeader>
                                            <CardTitle className="text-base">Junior Equity Innovation</CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm">
                                            <p className="mb-3">
                                                To attract impact investors seeking <em>concessionary returns</em>, Sofia added a
                                                <strong> first-loss "Junior Equity" tranche</strong>:
                                            </p>
                                            <ul className="space-y-1">
                                                <li>• Absorbs first losses (downside protection for senior LPs)</li>
                                                <li>• Target 6-8% IRR (below market, acceptable for impact capital)</li>
                                                <li>• Increases fund DSCR → enables more EIB leverage</li>
                                            </ul>
                                        </CardContent>
                                    </Card>
                                </AccordionContent>
                            </AccordionItem>

                            {/* Chapter 5 */}
                            <AccordionItem value="chapter5" className="border rounded-lg px-2">
                                <AccordionTrigger className="px-4 hover:no-underline">
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center text-green-700 font-bold text-lg">5</div>
                                        <div>
                                            <div className="font-bold text-lg">The Pitch</div>
                                            <div className="text-sm text-muted-foreground font-normal">March 2024 • Investment Committee decision day...</div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-6 pt-4 space-y-6">
                                    <p className="text-base">
                                        <strong>March 12, 2024</strong> — Exactly one year after the initial discovery. Sofia stood before
                                        Europa Capital's Investment Committee with 94 slides and a detailed financial model.
                                    </p>

                                    <div className="bg-slate-100 border-2 border-slate-300 p-5 rounded space-y-4">
                                        <div className="font-bold text-lg">Key Questions from IC:</div>

                                        <div className="border-l-4 border-amber-500 pl-4">
                                            <div className="font-semibold text-amber-900">❓ "What if there's another Greek debt crisis?"</div>
                                            <div className="text-sm text-slate-700 mt-1">
                                                <strong>Sofia's answer:</strong> "27% in Sweden (AAA-rated). EIF co-investment provides downside floor.
                                                Historical data shows affordable housing has &lt;0.5% correlation with sovereign yields."
                                            </div>
                                        </div>

                                        <div className="border-l-4 border-amber-500 pl-4">
                                            <div className="font-semibold text-amber-900">❓ "Can you really execute 50+ development projects across 7 countries?"</div>
                                            <div className="text-sm text-slate-700 mt-1">
                                                <strong>Sofia's answer:</strong> "We've partnered with established local developers in each market.
                                                EIF has vetted the pipeline. Target: 10-12 projects initially, scale to 50+ by Year 3."
                                            </div>
                                        </div>

                                        <div className="border-l-4 border-amber-500 pl-4">
                                            <div className="font-semibold text-amber-900">❓ "What's your edge vs. Blackstone/Brookfield?"</div>
                                            <div className="text-sm text-slate-700 mt-1">
                                                <strong>Sofia's answer:</strong> "They won't touch 'affordable' due to brand risk.
                                                We have EIF/EIB relationships they can't access. Our thesis is contrarian — for now."
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-green-50 border-4 border-green-500 p-6 rounded-lg text-center">
                                        <div className="text-5xl mb-3">🎉</div>
                                        <div className="font-bold text-2xl text-green-900 mb-2">Investment Committee: APPROVED</div>
                                        <div className="text-lg text-green-800">
                                            <strong>€700 Million</strong> first close<br />
                                            Target fund size: <strong>€1.2 Billion</strong>
                                        </div>
                                        <div className="text-sm text-green-700 mt-3">
                                            Lead LPs: Dutch pension fund (€200M), German insurance (€150M), EIF (€200M)
                                        </div>
                                    </div>

                                    <div className="bg-secondary/10 border-l-4 border-secondary p-4 rounded-r italic">
                                        <p className="font-semibold">Sofia's reflection (March 2024):</p>
                                        <p className="text-sm mt-2">
                                            "A year ago this was just a number in a Eurostat report. Today it's the largest affordable housing
                                            fund in European history. The key was refusing to accept that 'affordable' meant 'unprofitable.'
                                            We proved you can do well by doing good— but only with the right structure."
                                        </p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        {/* Performance Summary */}
                        <Card className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white border-none">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-secondary" />
                                    Fund Performance Metrics (Historical Backtest 2013-2024)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                                        <div className="text-3xl font-bold text-secondary mb-1">11.1%</div>
                                        <div className="text-sm text-slate-300">Historical Return</div>
                                        <div className="text-xs text-slate-400">(2013-2024)</div>
                                    </div>
                                    <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                                        <div className="text-3xl font-bold text-secondary mb-1">2.94</div>
                                        <div className="text-sm text-slate-300">Sharpe Ratio</div>
                                        <div className="text-xs text-slate-400">Research Grade</div>
                                    </div>
                                    <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                                        <div className="text-3xl font-bold text-secondary mb-1">3.1%</div>
                                        <div className="text-sm text-slate-300">Volatility</div>
                                        <div className="text-xs text-slate-400">Low Risk</div>
                                    </div>
                                    <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                                        <div className="text-3xl font-bold text-secondary mb-1">32M</div>
                                        <div className="text-sm text-slate-300">Households</div>
                                        <div className="text-xs text-slate-400">EU-27 + UK</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Call to Action */}
                        <Card className="border-2 border-secondary bg-secondary/5">
                            <CardContent className="pt-6">
                                <div className="text-center space-y-4">
                                    <h3 className="text-2xl font-bold">Your Turn: Run the Numbers</h3>
                                    <p className="text-muted-foreground max-w-2xl mx-auto">
                                        You've followed Sofia's journey from discovery to deal close. Now explore the simulator to build
                                        your own fund model. Start with <strong>Fundamentals</strong> to design the capital stack.
                                    </p>
                                    <Button size="lg" onClick={() => setActiveTab('course')} className="gap-2">
                                        Continue to Fundamentals Tab
                                        <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    {/* --- TAB 7: TECHNICAL DOCUMENTATION --- */}
                    <TabsContent value="technical" className="space-y-6 mt-6">
                        {/* Introduction */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-secondary" />
                                    Technical Documentation: Fund Simulator Methodology
                                </CardTitle>
                                <CardDescription>
                                    Complete formulas and calculation steps for Excel replication. All computations are transparent and auditable.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600">
                                    This page documents every formula used in the Fund Simulator. You can replicate the entire model in Excel using these specifications.
                                    All formulas are presented in standard Excel notation where applicable.
                                </p>
                            </CardContent>
                        </Card>

                        {/* 1. Capital Stack Construction */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">1. Capital Stack Construction</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Base Equity</div>
                                    <code>baseEquity = privateEquity + eifEquity</code>
                                    <div className="text-xs text-slate-600 mt-1">Sum of private LP capital and EIF public equity</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Junior Equity (First Loss)</div>
                                    <code>juniorEquity = baseEquity × (juniorEquityPct / (1 - juniorEquityPct))</code>
                                    <div className="text-xs text-slate-600 mt-1">Example: If junior is 10% of total, and base = €700M, then junior = €700M × (0.10 / 0.90) = €77.8M</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Total Equity</div>
                                    <code>totalEquity = baseEquity + juniorEquity</code>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Fund Debt (EIB Forward Credit)</div>
                                    <code>fundDebt = totalEquity × (fundLeverage / (1 - fundLeverage))</code>
                                    <div className="text-xs text-slate-600 mt-1">Example: If leverage = 50% (meaning 50/50 debt/equity), fundDebt = totalEquity × (0.50 / 0.50) = totalEquity</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Total Capital</div>
                                    <code>totalCapital = totalEquity + fundDebt</code>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Country Portfolio Mix */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">2. Country Portfolio Mix & Development Phase</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Normalized Weights</div>
                                    <code>normWeight[i] = weight[i] / SUM(all weights)</code>
                                    <div className="text-xs text-slate-600 mt-1">Ensures weights sum to 100%</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Total Development Cost</div>
                                    <code>totalDevCost = totalCapital / (1 - assetLtc)</code>
                                    <div className="text-xs text-slate-600 mt-1">If using project-level construction debt. Example: €700M equity @ 70% LTC → Total = €700M / 0.30 = €2.33B</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Asset Development Debt</div>
                                    <code>assetDevDebt = totalDevCost - totalCapital</code>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Country-Specific Development (for each country i)</div>
                                    <code>countryCost[i] = totalDevCost × normWeight[i]</code><br />
                                    <code>countryDebt[i] = countryCost[i] × assetLtc</code><br />
                                    <code>countryEquity[i] = countryCost[i] - countryDebt[i]</code>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 3. Stabilization Value & NOI */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">3. Stabilization Value & NOI Calculation</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Equity Value at Stabilization (Per Country)</div>
                                    <code>equityValueStab[i] = countryEquity[i] × (1 + devIRR[i])^devYears</code>
                                    <div className="text-xs text-slate-600 mt-1">Value growth during development phase (typically 3 years)</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Total Property Value at Stabilization</div>
                                    <code>valueStab[i] = equityValueStab[i] + countryDebt[i]</code>
                                    <div className="text-xs text-slate-600 mt-1">Asset debt remains constant during development</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Net Operating Income (NOI) at Stabilization</div>
                                    <code>noiStab[i] = valueStab[i] × exitCap[i]</code>
                                    <div className="text-xs text-slate-600 mt-1">Reverse cap rate calculation: Value × Cap Rate = NOI</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Portfolio Totals</div>
                                    <code>totalValueStab = SUM(valueStab[i])</code><br />
                                    <code>totalNoiStab = SUM(noiStab[i])</code>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">NOI Growth Over Time</div>
                                    <code>NOI[t] = totalNoiStab × (1 + wavgInflation)^(t - devYears - 1)</code>
                                    <div className="text-xs text-slate-600 mt-1">For t &gt; devYears. NOI grows at weighted average inflation rate.</div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 4. Debt Service Calculations */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">4. Debt Service Calculations</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Amortization Formula (Standard)</div>
                                    <code>Payment = Principal × [r(1+r)^n] / [(1+r)^n - 1]</code>
                                    <div className="text-xs text-slate-600 mt-1">Where r = periodic rate, n = number of periods</div>
                                    <div className="text-xs text-slate-600">Excel: =PMT(rate, nper, -principal)</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">EIB Fund Debt Service</div>
                                    <code>eibPayment[t] = PMT(fundDebtRate, totalHor izon, -fundDebt)</code>
                                    <div className="text-xs text-slate-600 mt-1">Amortizing loan over full horizon (e.g., 23 years)</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Property Loan (Refinancing at Stabilization)</div>
                                    <code>propLoanPrincipal = assetDevDebt + buyoutAmount</code><br />
                                    <code>buyoutAmount = netProjectVal × (privateEquity/totalEquity) × impactExitPct</code><br />
                                    <code>propPayment = PMT(propLoanRate, holdYears, -propLoanPrincipal)</code>
                                    <div className="text-xs text-slate-600 mt-1">Refinancing loan to repay construction debt + buy out impact investors</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Total Debt Service (for DSCR)</div>
                                    <code>totalDebtService[t] = eibPayment[t] + propPayment[t - devYears]</code>
                                    <div className="text-xs text-slate-600 mt-1">Property loan starts after development period</div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 5. DSCR Calculation */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">5. Debt Service Coverage Ratio (DSCR)</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">DSCR Formula</div>
                                    <code>DSCR[t] = NOI[t] / totalDebtService[t]</code>
                                    <div className="text-xs text-slate-600 mt-1">Measures ability to cover debt payments from operating income</div>
                                    <div className="text-xs text-slate-600">Example: €111M NOI / €23M Debt Service = 4.83x</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Impact Exit Constraint (DSCR Floor)</div>
                                    <code>maxDebtService = year4NOI / 1.10</code><br />
                                    <code>maxLoan = maxDebtService / propLoanRate</code><br />
                                    <code>maxBuyout = maxLoan - assetDevDebt</code><br />
                                    <code>maxImpactExitPct = maxBuyout / (netVal × privShare)</code>
                                    <div className="text-xs text-slate-600 mt-1">Ensures Year 4 DSCR ≥ 1.10x by capping Impact Exit %</div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 6. Cash Flow Construction */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">6. Equity Cash Flow Construction</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Annual Equity Cash Flow</div>
                                    <code>CF[t] = NOI[t] - eibPayment[t] - propPayment[t]</code>
                                    <div className="text-xs text-slate-600 mt-1">For operational years (t &gt; devYears)</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Refinancing Event (Year 3+)</div>
                                    <code>CF[devYears] += (propLoanPrincipal - assetDevDebt)</code>
                                    <div className="text-xs text-slate-600 mt-1">Net cash from refinancing after paying off construction debt</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Terminal Value (Exit Year)</div>
                                    <code>exitValue = NOI[T] / marketCapRate</code><br />
                                    <code>CF[T] += exitValue - propLoanBalance[T] - eibBalance[T]</code>
                                    <div className="text-xs text-slate-600 mt-1">Sell property, repay all debt, distribute equity proceeds</div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 7. Waterfall Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">7. European Waterfall Distribution</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Step 1: Return of Capital</div>
                                    <code>capitalRemaining[t] = MAX(0, investedCapital - SUM(lpCash[0..t-1]))</code><br />
                                    <code>rocPayment[t] = MIN(availableCash[t], capitalRemaining[t])</code>
                                    <div className="text-xs text-slate-600 mt-1">LPs get 100% of capital back first</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Step 2: Preferred Return (Hurdle)</div>
                                    <code>unpaidPref[t] = unpaidPref[t-1] × (1 + hurdleRate) - prefPayment[t-1]</code><br />
                                    <code>prefPayment[t] = MIN(cashAfterROC[t], unpaidPref[t])</code>
                                    <div className="text-xs text-slate-600 mt-1">LPs earn hurdle rate (e.g., 8%) on outstanding capital</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Step 3: GP Catch-Up</div>
                                    <code>gpOwedTotal = (rocPaid + prefPaid) × (promoteRate / (1 - promoteRate))</code><br />
                                    <code>catchUpPayment = MIN(cashAfterPref, gpOwedTotal - gpPaidSoFar) × catchUpRate</code>
                                    <div className="text-xs text-slate-600 mt-1">GP catches up to their promote % (e.g., 20%). catchUpRate typically 100%.</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Step 4: Promote Split</div>
                                    <code>lpPromoteCash = remainingCash × (1 - promoteRate)</code><br />
                                    <code>gpPromoteCash = remainingCash × promoteRate</code>
                                    <div className="text-xs text-slate-600 mt-1">Final split: e.g., 80/20 LP/GP</div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 8. IRR & MO IC */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">8. Performance Metrics: IRR & MOIC</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">IRR (Internal Rate of Return)</div>
                                    <code>NPV = SUM[CF[t] / (1 + IRR)^t] = 0</code>
                                    <div className="text-xs text-slate-600 mt-1">Solve for IRR iteratively using Newton-Raphson method</div>
                                    <div className="text-xs text-slate-600">Excel: =IRR(cashFlowRange)</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">MOIC (Multiple on Invested Capital)</div>
                                    <code>MOIC = SUM(positive cash flows) / SUM(negative cash flows)</code>
                                    <div className="text-xs text-slate-600 mt-1">Total cash returned divided by total cash invested</div>
                                    <div className="text-xs text-slate-600">Example: €1.4B returned / €700M invested = 2.0x MOIC</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Gross vs Net Returns</div>
                                    <code>Gross IRR = IRR(equity cash flows before fees/promote)</code><br />
                                    <code>Net IRR = IRR(LP cash flows after fees/promote)</code>
                                    <div className="text-xs text-slate-600 mt-1">Net returns account for management fees and carried interest</div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 9. Tranche Allocation (First Loss) */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">9. Tranche Allocation: First Loss Logic</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Loss Absorption (Junior First)</div>
                                    <code>IF cashFlow &lt; 0 THEN:</code><br />
                                    <code>&nbsp;&nbsp;juniorAbsorb = MAX(cashFlow, -juniorRemaining)</code><br />
                                    <code>&nbsp;&nbsp;remainingLoss = cashFlow - juniorAbsorb</code><br />
                                    <code>&nbsp;&nbsp;privateShare = remainingLoss × (privateEquity/baseEquity)</code><br />
                                    <code>&nbsp;&nbsp;eifShare = remainingLoss × (eifEquity/baseEquity)</code>
                                    <div className="text-xs text-slate-600 mt-1">Junior equity absorbs losses first, then pro-rata across Private/EIF</div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg font-mono text-sm">
                                    <div className="font-bold text-slate-900 mb-2">Profit Distribution</div>
                                    <code>IF cashFlow &gt; 0 THEN:</code><br />
                                    <code>&nbsp;&nbsp;privateShare = cashFlow × (privateEquity/totalEquity)</code><br />
                                    <code>&nbsp;&nbsp;eifShare = cashFlow × (eifEquity/totalEquity)</code><br />
                                    <code>&nbsp;&nbsp;juniorShare = cashFlow × (juniorEquity/totalEquity)</code>
                                    <div className="text-xs text-slate-600 mt-1">Profits distributed pro-rata across all tranches</div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Excel Template Guide */}
                        <Card className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white border-none">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-secondary" />
                                    Excel Replication Guide
                                </CardTitle>
                                <CardDescription className="text-slate-300">
                                    Step-by-step instructions for building the model in Excel
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4 text-sm">
                                    <div>
                                        <div className="font-bold mb-2">Tab 1: Assumptions</div>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-200">
                                            <li>Create named ranges for all inputs (privateEquity, eifEquity, fundLeverage, etc.)</li>
                                            <li>Country table with weights, devIRRs, exitCaps, inflation rates</li>
                                            <li>Use data validation for dropdowns and input constraints</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <div className="font-bold mb-2">Tab 2: Capital Stack</div>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-200">
                                            <li>Calculate baseEquity, juniorEquity, totalEquity, fundDebt</li>
                                            <li>Show visual waterfall chart of capital structure</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <div className="font-bold mb-2">Tab 3: Development & Stabilization</div>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-200">
                                            <li>Country-by-country calculations using SUMPRODUCT for weighted averages</li>
                                            <li>FV formulas for equity growth: =FV(devIRR, devYears, 0, -countryEquity)</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <div className="font-bold mb-2">Tab 4: Cash Flows</div>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-200">
                                            <li>Time series from Year 0 to Year 23 (or holdYears)</li>
                                            <li>Use PMT() for debt service, grow NOI with inflation index</li>
                                            <li>Add refinancing row at Year devYears</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <div className="font-bold mb-2">Tab 5: Waterfall</div>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-200">
                                            <li>Cumulative tracking of capital returned, pref owed, GP paid</li>
                                            <li>Use helper columns for each waterfall tier</li>
                                            <li>Final columns: lpCash[t], gpCash[t]</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <div className="font-bold mb-2">Tab 6: Returns</div>
                                        <ul className="list-disc pl-5 space-y-1 text-slate-200">
                                            <li>=IRR(cashFlowRange) for both gross and net</li>
                                            <li>=SUMIF() for positive/negative flows to calculate MOIC</li>
                                            <li>Sensitivity tables using Data Table feature (Alt+D+T)</li>
                                        </ul>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Download Link for Excel Template */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Download Excel Template</CardTitle>
                                <CardDescription>Professional Goldman Sachs-style model with default case pre-populated</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 mb-4">
                                    A pre-built Excel template matching the default case will be available for download. The template includes:
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600 mb-6">
                                    <li>All formulas implemented and auditable</li>
                                    <li>Professional Goldman Sachs color scheme and formatting</li>
                                    <li>Dynamic charts and sensitivity analysis</li>
                                    <li>Data validation on all inputs</li>
                                    <li>Comprehensive documentation tab</li>
                                </ul>
                                <div className="bg-slate-100 p-4 rounded-lg text-sm text-slate-600 italic">
                                    Excel template artifacts will be generated and made available through the artifacts system.
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                </Tabs>
            </div>
        </div >
    );
}
