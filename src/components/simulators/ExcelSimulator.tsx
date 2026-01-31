import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, AlertCircle, Calculator } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CellData {
    value: string;
    formula: string;
    display: string;
}

export default function ExcelSimulator() {
    const [cells, setCells] = useState<Record<string, CellData>>({
        'A1': { value: 'Rate', formula: 'Rate', display: 'Rate' },
        'B1': { value: '0.05', formula: '0.05', display: '5%' },
        'A2': { value: 'Nper', formula: 'Nper', display: 'Nper' },
        'B2': { value: '10', formula: '10', display: '10' },
        'A3': { value: 'Pmt', formula: 'Pmt', display: 'Pmt' },
        'B3': { value: '1000', formula: '1000', display: '1000' },
        'A4': { value: 'PV', formula: 'PV', display: 'PV' },
    });

    const [activeCell, setActiveCell] = useState<string | null>(null);
    const [formulaBar, setFormulaBar] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleCellClick = (cellId: string) => {
        setActiveCell(cellId);
        setFormulaBar(cells[cellId]?.formula || '');
        setFeedback(null);
    };

    const handleFormulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormulaBar(e.target.value);
    };

    const evaluateFormula = (formula: string): string => {
        if (!formula.startsWith('=')) return formula;

        const expression = formula.substring(1).toUpperCase();

        // Simple mock evaluation for PV formula
        // =PV(rate, nper, pmt)
        // =PV(B1, B2, B3)

        if (expression.startsWith('PV')) {
            // Extract args
            try {
                const argsStr = expression.match(/\((.*)\)/)?.[1];
                if (!argsStr) throw new Error("Invalid syntax");

                const args = argsStr.split(',').map(a => a.trim());

                const getVal = (ref: string) => {
                    const val = cells[ref]?.value;
                    return val ? parseFloat(val) : parseFloat(ref);
                };

                const rate = getVal(args[0]);
                const nper = getVal(args[1]);
                const pmt = getVal(args[2]);

                if (isNaN(rate) || isNaN(nper) || isNaN(pmt)) throw new Error("Invalid arguments");

                // PV formula: Pmt * (1 - (1+r)^-n) / r
                const pv = pmt * (1 - Math.pow(1 + rate, -nper)) / rate;
                setFeedback({ type: 'success', message: "Correct! You successfully calculated the Present Value." });
                return (-pv).toFixed(2); // Excel returns negative
            } catch (e) {
                setFeedback({ type: 'error', message: "Error in formula. Check your syntax: =PV(rate, nper, pmt)" });
                return "#ERROR";
            }
        }

        return "#NAME?";
    };

    const handlesubmit = () => {
        if (!activeCell) return;

        const display = evaluateFormula(formulaBar);
        setCells(prev => ({
            ...prev,
            [activeCell]: {
                value: display,
                formula: formulaBar,
                display: display
            }
        }));
    };

    const cellId = (r: number, c: number) => `${String.fromCharCode(65 + c)}${r + 1}`;

    return (
        <Card className="min-h-[500px] flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calculator className="w-4 h-4" /> Excel Training Lab: PV Function
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
                {/* Formula Bar */}
                <div className="flex gap-2 items-center">
                    <div className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded text-xs font-bold text-slate-500">
                        {activeCell || 'fx'}
                    </div>
                    <Input
                        value={formulaBar}
                        onChange={handleFormulaChange}
                        placeholder="Enter formula, e.g. =PV(B1, B2, B3)"
                        className="font-mono"
                    />
                    <Button onClick={handlesubmit} size="sm">Enter</Button>
                </div>

                {/* Grid */}
                <div className="border rounded-md overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead className="w-10 bg-slate-100"></TableHead>
                                <TableHead className="w-32 text-center border-l">A</TableHead>
                                <TableHead className="w-32 text-center border-l">B</TableHead>
                                <TableHead className="w-32 text-center border-l">C</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[0, 1, 2, 3, 4].map(row => (
                                <TableRow key={row}>
                                    <TableCell className="bg-slate-50 font-mono text-xs text-center text-slate-400 border-r">{row + 1}</TableCell>
                                    {[0, 1, 2].map(col => {
                                        const id = cellId(row, col);
                                        const cell = cells[id];
                                        return (
                                            <TableCell
                                                key={col}
                                                className={`border-r p-0 relative hover:bg-blue-50 cursor-cell ${activeCell === id ? 'ring-2 ring-blue-500 z-10' : ''}`}
                                                onClick={() => handleCellClick(id)}
                                            >
                                                <div className="w-full h-10 flex items-center px-2 truncate font-mono text-sm">
                                                    {cell?.display}
                                                </div>
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Feedback */}
                {feedback && (
                    <Alert variant={feedback.type === 'error' ? 'destructive' : 'default'} className={feedback.type === 'success' ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : ''}>
                        {feedback.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <AlertTitle>{feedback.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
                        <AlertDescription>{feedback.message}</AlertDescription>
                    </Alert>
                )}

                <div className="text-sm text-muted-foreground mt-4">
                    <p><strong>Goal:</strong> Calculate the Present Value (PV) in cell <strong>B4</strong>.</p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Rate is in <strong>B1</strong></li>
                        <li>Periods (Nper) is in <strong>B2</strong></li>
                        <li>Payment (Pmt) is in <strong>B3</strong></li>
                        <li>Use the formula: <code>=PV(B1, B2, B3)</code></li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}
