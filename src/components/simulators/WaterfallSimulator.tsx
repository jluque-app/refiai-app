import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Layers } from 'lucide-react';

export function WaterfallSimulator() {
    const [equityInvested, setEquityInvested] = useState(1000000);
    const [prefRate, setPrefRate] = useState(8.0);
    const [promoteLevel, setPromoteLevel] = useState(20.0);
    const [exitProceeds, setExitProceeds] = useState(1500000);
    const [holdPeriod, setHoldPeriod] = useState(3);

    const [distribution, setDistribution] = useState<any>({});

    useEffect(() => {
        calculateWaterfall();
    }, [equityInvested, prefRate, promoteLevel, exitProceeds, holdPeriod]);

    const calculateWaterfall = () => {
        // Simple 2-tier waterfall: Return of Capital + Pref -> Split (Promote)

        // 1. Return of Capital
        const returnOfCapital = Math.min(equityInvested, exitProceeds);
        let remaining = exitProceeds - returnOfCapital;

        // 2. Preferred Return
        // Simplified: simple interest accumulation for demo (or compounded)
        // Let's use compounded annually.
        const requiredPref = equityInvested * (Math.pow(1 + prefRate / 100, holdPeriod) - 1);
        const prefPayment = Math.min(requiredPref, remaining);
        remaining -= prefPayment;

        // 3. Promote (Residual Split)
        // LP gets (100% - promote), GP gets promote
        const gpDeep = remaining * (promoteLevel / 100);
        const lpDeep = remaining - gpDeep;

        // Total LP
        const lpTotal = returnOfCapital + prefPayment + lpDeep;
        const gpTotal = gpDeep; // Assuming GP put in 0 for this simple exercise

        setDistribution({
            lpCapital: returnOfCapital,
            lpPref: prefPayment,
            lpPromote: lpDeep,
            gpPromote: gpDeep,
            lpTotal,
            gpTotal
        });
    };

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    const chartData = [
        { name: 'LP (Investor)', Return: distribution.lpPref + distribution.lpPromote, Capital: distribution.lpCapital },
        { name: 'GP (Sponsor)', Return: distribution.gpPromote, Capital: 0 },
    ];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-purple-600" />
                        Capital Stack Waterfall
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Equity Potential (LP)</Label>
                            <Input type="number" value={equityInvested} onChange={(e) => setEquityInvested(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Preferred Return (%)</Label>
                            <Input type="number" value={prefRate} onChange={(e) => setPrefRate(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                            <Label>GP Promote (%)</Label>
                            <Input type="number" value={promoteLevel} onChange={(e) => setPromoteLevel(Number(e.target.value))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Exit Proceeds</Label>
                            <Input type="number" value={exitProceeds} onChange={(e) => setExitProceeds(Number(e.target.value))} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div className="border rounded-lg p-4 bg-slate-50">
                            <h3 className="font-semibold mb-4 text-sm uppercase text-slate-500">Distribution Waterfall</h3>
                            <Table>
                                <TableBody>
                                    <TableRow>
                                        <TableCell>1. Return of Capital</TableCell>
                                        <TableCell className="text-right">{formatCurrency(distribution.lpCapital || 0)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>2. Preferred Return</TableCell>
                                        <TableCell className="text-right text-emerald-600">{formatCurrency(distribution.lpPref || 0)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell>3. LP Profit (Residual)</TableCell>
                                        <TableCell className="text-right text-blue-600">{formatCurrency(distribution.lpPromote || 0)}</TableCell>
                                    </TableRow>
                                    <TableRow className="font-bold border-t-2">
                                        <TableCell>Total LP</TableCell>
                                        <TableCell className="text-right">{formatCurrency(distribution.lpTotal || 0)}</TableCell>
                                    </TableRow>
                                    <TableRow className="bg-purple-50">
                                        <TableCell>GP Promote (Perf. Fee)</TableCell>
                                        <TableCell className="text-right text-purple-700">{formatCurrency(distribution.gpPromote || 0)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} />
                                    <Tooltip formatter={(val: number | undefined) => formatCurrency(val || 0)} />
                                    <Legend />
                                    <Bar dataKey="Capital" stackId="a" fill="#94a3b8" />
                                    <Bar dataKey="Return" stackId="a" fill="#10b981" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
