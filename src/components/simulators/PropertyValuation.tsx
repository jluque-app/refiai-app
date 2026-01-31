"use client";

import { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar } from "recharts";
import clsx from "clsx";

interface Inputs {
    pgi: number;
    vacancyRate: number;
    growthRate: number;
    opexRatio: number; // % of EGI
    capexRatio: number; // % of NOI
    years: number;
    capRate: number;
    terminalCapRate: number;
    discountRate: number;
    costOfSale: number;
}

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-EU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val);
};

export default function PropertyValuationSimulator() {
    const [inputs, setInputs] = useState<Inputs>({
        pgi: 1500000,
        vacancyRate: 5.0,
        growthRate: 2.0,
        opexRatio: 35.0,
        capexRatio: 5.0,
        years: 10,
        capRate: 6.0,
        terminalCapRate: 6.5,
        discountRate: 9.0,
        costOfSale: 2.0,
    });

    const updateInput = (key: keyof Inputs, val: number) => {
        setInputs((prev) => ({ ...prev, [key]: val }));
    };

    // --- Calculations ---
    const results = useMemo(() => {
        const { pgi, vacancyRate, growthRate, opexRatio, capexRatio, years, capRate, terminalCapRate, discountRate, costOfSale } = inputs;

        // Convert % to decimals
        const vac = vacancyRate / 100;
        const g = growthRate / 100;
        const opex = opexRatio / 100;
        const capex = capexRatio / 100;
        const cap = capRate / 100;
        const tCap = terminalCapRate / 100;
        const disc = discountRate / 100;
        const saleCost = costOfSale / 100;

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
                vacancy: vacancyLoss,
                egi,
                opex: operatingExpenses,
                noi,
                capex: capitalImprovements,
                pbtcf
            });
        }

        // Terminal Value
        const lastNoi = proforma[years - 1].noi;
        const nextNoi = lastNoi * (1 + g);
        const terminalValue = nextNoi / tCap;
        const nsp = terminalValue * (1 - saleCost);

        // DCF Logic
        let pvOps = 0;
        proforma.forEach((row) => {
            const discountFactor = Math.pow(1 + disc, row.year);
            pvOps += row.pbtcf / discountFactor;
        });

        const pvSale = nsp / Math.pow(1 + disc, years);
        const dcfValue = pvOps + pvSale;

        // Direct Cap
        const noi1 = proforma[0].noi;
        const directCapValue = noi1 / cap;

        return {
            proforma,
            dcfValue,
            directCapValue,
            nsp,
            terminalValue,
            noi1
        };
    }, [inputs]);

    return (
        <div className="space-y-8 p-1">
            <div className="bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))] rounded-[var(--radius)] p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    🧮 Valuation Simulator
                </h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
                    Adjust the assumptions below to see how they impact the Property Value using Direct Cap and DCF methods.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Column 1 */}
                    <div className="space-y-4">
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
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Vacancy (%)</label>
                            <input
                                type="range" min="0" max="20" step="0.5"
                                value={inputs.vacancyRate}
                                onChange={(e) => updateInput('vacancyRate', Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{inputs.vacancyRate}%</div>
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
                    </div>

                    {/* Column 2 */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Opex (% of EGI)</label>
                            <input
                                type="range" min="10" max="60" step="1"
                                value={inputs.opexRatio}
                                onChange={(e) => updateInput('opexRatio', Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{inputs.opexRatio}%</div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">CapEx (% of NOI)</label>
                            <input
                                type="range" min="0" max="20" step="0.5"
                                value={inputs.capexRatio}
                                onChange={(e) => updateInput('capexRatio', Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{inputs.capexRatio}%</div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Years (N)</label>
                            <input
                                type="number"
                                value={inputs.years}
                                onChange={(e) => updateInput('years', Number(e.target.value))}
                                className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    {/* Column 3 - Rates */}
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Cap Rate (%)</label>
                            <input
                                type="range" min="2" max="12" step="0.25"
                                value={inputs.capRate}
                                onChange={(e) => updateInput('capRate', Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{inputs.capRate}%</div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Terminal Cap (%)</label>
                            <input
                                type="range" min="2" max="12" step="0.25"
                                value={inputs.terminalCapRate}
                                onChange={(e) => updateInput('terminalCapRate', Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{inputs.terminalCapRate}%</div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Discount Rate (%)</label>
                            <input
                                type="range" min="2" max="20" step="0.5"
                                value={inputs.discountRate}
                                onChange={(e) => updateInput('discountRate', Number(e.target.value))}
                                className="w-full accent-[hsl(var(--primary))]"
                            />
                            <div className="text-right text-xs">{inputs.discountRate}%</div>
                        </div>
                    </div>

                    {/* Column 4 - Results Preview */}
                    <div className="flex flex-col justify-center space-y-6 bg-[hsl(var(--surface))] p-4 rounded border border-[hsl(var(--border))]">
                        <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">Direct Cap Value</div>
                            <div className="text-2xl font-bold text-[hsl(var(--primary))]">{formatCurrency(results.directCapValue)}</div>
                            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">NOI Year 1 / {inputs.capRate}%</div>
                        </div>
                        <div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">DCF Value</div>
                            <div className="text-2xl font-bold text-[hsl(var(--secondary))]">{formatCurrency(results.dcfValue)}</div>
                            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">PV(CF) + PV(NSP) @ {inputs.discountRate}%</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="h-[300px] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4">
                    <h3 className="text-sm font-bold mb-4">Cash Flow Forecast (PBTCF)</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={results.proforma}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="year" />
                            <YAxis tickFormatter={(val) => `€${val / 1000}k`} />
                            <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''} />
                            <Line type="monotone" dataKey="pbtcf" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="h-[300px] border border-[hsl(var(--border))] rounded-[var(--radius)] p-4">
                    <h3 className="text-sm font-bold mb-4">Valuation Comparison</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                            { name: 'Direct Cap', value: results.directCapValue, fill: 'hsl(var(--primary))' },
                            { name: 'DCF', value: results.dcfValue, fill: 'hsl(var(--secondary))' }
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="name" />
                            <YAxis tickFormatter={(val) => `€${val / 1000000}M`} />
                            <Tooltip cursor={{ fill: 'transparent' }} formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : ''} />
                            {/* <Legend /> */}
                            <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
