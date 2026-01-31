import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator } from 'lucide-react';

type MortgageType = 'IO' | 'CPM' | 'CAM';

export function MortgageMasterSimulator() {
  const [loanAmount, setLoanAmount] = useState(1000000);
  const [interestRate, setInterestRate] = useState(5.0);
  const [termYears, setTermYears] = useState(20);
  const [type, setType] = useState<MortgageType>('CPM');
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => {
    calculateSchedule();
  }, [loanAmount, interestRate, termYears, type]);

  const calculateSchedule = () => {
    const r = interestRate / 100;
    const n = termYears;
    const rows = [];
    let balance = loanAmount;

    for (let year = 1; year <= n; year++) {
      let payment = 0;
      let interest = balance * r;
      let principal = 0;

      if (type === 'IO') {
        payment = interest;
        principal = year === n ? balance : 0;
      } else if (type === 'CPM') {
        // PMT formula
        payment = (loanAmount * r) / (1 - Math.pow(1 + r, -n));
        principal = payment - interest;
      } else if (type === 'CAM') {
        principal = loanAmount / n;
        payment = interest + principal;
      }

      balance -= principal;
      // Handle floating point errors
      if (balance < 1) balance = 0;

      rows.push({
        year,
        payment,
        interest,
        principal,
        balance
      });
    }
    setSchedule(rows);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-600" />
            Mortgage Structure Analyzer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Loan Amount</Label>
              <Input 
                type="number" 
                value={loanAmount} 
                onChange={(e) => setLoanAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Interest Rate (%)</Label>
              <Input 
                type="number" 
                value={interestRate} 
                onChange={(e) => setInterestRate(Number(e.target.value))}
                step="0.1"
              />
            </div>
            <div className="space-y-2">
              <Label>Term (Years)</Label>
              <Input 
                type="number" 
                value={termYears} 
                onChange={(e) => setTermYears(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Amortization Type</Label>
              <Select value={type} onValueChange={(v: MortgageType) => setType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPM">Constant Payment (CPM)</SelectItem>
                  <SelectItem value="CAM">Constant Amortization (CAM)</SelectItem>
                  <SelectItem value="IO">Interest Only (IO)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6 border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((row) => (
                  <TableRow key={row.year}>
                    <TableCell>{row.year}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(row.payment)}</TableCell>
                    <TableCell className="text-slate-500">{formatCurrency(row.interest)}</TableCell>
                    <TableCell className="text-emerald-600">{formatCurrency(row.principal)}</TableCell>
                    <TableCell>{formatCurrency(row.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
