import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function KPICard({ label, value, unit, className }) {
  const formatValue = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'number') {
      if (Math.abs(val) >= 1000000) {
        return (val / 1000000).toFixed(2) + 'M';
      }
      if (Math.abs(val) >= 1000) {
        return (val / 1000).toFixed(1) + 'K';
      }
      if (val % 1 !== 0) {
        return val.toFixed(2);
      }
      return val.toLocaleString();
    }
    return String(val);
  };

  return (
    <Card className={cn("bg-white border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-5">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{label}</p>
        <p className="text-2xl font-semibold text-slate-900 tracking-tight">
          {formatValue(value)}
          {unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}
        </p>
      </CardContent>
    </Card>
  );
}