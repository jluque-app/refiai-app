import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DataTable({ data, className }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No data available
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  const formatCell = (value) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      if (Math.abs(value) >= 1000000) {
        return (value / 1000000).toFixed(2) + 'M';
      }
      if (value % 1 !== 0) {
        return value.toFixed(2);
      }
      return value.toLocaleString();
    }
    return String(value);
  };

  const formatHeader = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  };

  return (
    <div className={`rounded-lg border border-slate-200 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              {columns.map((col) => (
                <TableHead 
                  key={col} 
                  className="text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap px-4 py-3"
                >
                  {formatHeader(col)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, rowIndex) => (
              <TableRow 
                key={rowIndex} 
                className="hover:bg-slate-50/50 transition-colors"
              >
                {columns.map((col) => (
                  <TableCell 
                    key={col} 
                    className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap"
                  >
                    {formatCell(row[col])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}