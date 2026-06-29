import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, RotateCcw, Plus, Trash2 } from "lucide-react";

/**
 * Legacy Fund Input Form (schema-driven, but we implement a first-class Country Mix editor)
 *
 * Expects `inputs` to be the same object passed to engine: { fund, rates, capital_programs, strategies, fees, preferred_equity, country_mix }
 * Uses `input_schema_json` defaults that were stored in Module record, but we keep it simple:
 * - if a nested object doesn't exist yet, we initialize it on change.
 */

function getPath(obj, path) {
  const parts = String(path || "").split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setPath(prev, path, value) {
  const parts = String(path || "").split(".");
  const next = { ...(prev || {}) };
  let cur = next;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    const isLast = i === parts.length - 1;
    if (isLast) {
      cur[key] = value;
    } else {
      const existing = cur[key];
      cur[key] = typeof existing === "object" && existing !== null ? { ...existing } : {};
      cur = cur[key];
    }
  }
  return next;
}

function fmtHelp(text) {
  return <div className="text-xs text-slate-500 mt-1 leading-snug">{text}</div>;
}

function NumberField({ inputs, onChange, label, path, step = 0.01, placeholder, help }) {
  const v = getPath(inputs, path);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-700">{label}</Label>
      <Input
        type="number"
        step={step}
        value={v ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          const num = raw === "" ? "" : Number(raw);
          onChange(setPath(inputs, path, raw === "" ? "" : num));
        }}
      />
      {help ? fmtHelp(help) : null}
    </div>
  );
}

function CheckboxField({ inputs, onChange, label, path, help }) {
  const v = !!getPath(inputs, path);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-700">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={v}
          onChange={(e) => onChange(setPath(inputs, path, !!e.target.checked))}
        />
        <span className="text-sm text-slate-700">{v ? "Yes" : "No"}</span>
      </div>
      {help ? fmtHelp(help) : null}
    </div>
  );
}

function SelectField({ inputs, onChange, label, path, options, help }) {
  const v = getPath(inputs, path) ?? options?.[0]?.value ?? "";
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-700">{label}</Label>
      <select
        className="w-full border rounded-md px-2 py-2 text-sm bg-white"
        value={v}
        onChange={(e) => onChange(setPath(inputs, path, e.target.value))}
      >
        {(options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {help ? fmtHelp(help) : null}
    </div>
  );
}

function CountryMixEditor({ inputs, onChange }) {
  const rows = Array.isArray(inputs?.country_mix) ? inputs.country_mix : [];

  const updateRow = (idx, key, value) => {
    const next = rows.map((r, i) => (i === idx ? { ...(r || {}), [key]: value } : r));
    onChange({ ...(inputs || {}), country_mix: next });
  };

  const removeRow = (idx) => {
    const next = rows.filter((_, i) => i !== idx);
    onChange({ ...(inputs || {}), country_mix: next });
  };

  const addRow = () => {
    const next = [
      ...rows,
      { country: "New", weight: 0.05, dev_irr: 0.10, aff_yield: 0.045, inflation: 0.02 },
    ];
    onChange({ ...(inputs || {}), country_mix: next });
  };

  return (
    <div className="space-y-2">
      <div className="text-sm text-slate-700">
        Enter country assumptions (weights will be normalized in the engine).
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
        {/* Wider columns, larger inputs so default values are fully visible */}
        <table className="min-w-[920px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left font-medium text-slate-700 px-3 py-2">Country</th>
              <th className="text-left font-medium text-slate-700 px-3 py-2">Weight</th>
              <th className="text-left font-medium text-slate-700 px-3 py-2">Dev IRR</th>
              <th className="text-left font-medium text-slate-700 px-3 py-2">Affordable Yield</th>
              <th className="text-left font-medium text-slate-700 px-3 py-2">Inflation</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-slate-100">
                <td className="px-3 py-3 text-slate-500" colSpan={6}>
                  No rows. Add at least one country.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <Input
                      className="w-[220px]"
                      value={r?.country ?? ""}
                      onChange={(e) => updateRow(idx, "country", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="w-[140px]"
                      type="number"
                      step="0.01"
                      value={r?.weight ?? ""}
                      onChange={(e) =>
                        updateRow(idx, "weight", e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="w-[160px]"
                      type="number"
                      step="0.005"
                      value={r?.dev_irr ?? ""}
                      onChange={(e) =>
                        updateRow(idx, "dev_irr", e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="w-[180px]"
                      type="number"
                      step="0.005"
                      value={r?.aff_yield ?? ""}
                      onChange={(e) =>
                        updateRow(idx, "aff_yield", e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      className="w-[160px]"
                      type="number"
                      step="0.005"
                      value={r?.inflation ?? ""}
                      onChange={(e) =>
                        updateRow(idx, "inflation", e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="outline" size="sm" onClick={() => removeRow(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Tip: set weights approximately — the engine normalizes them automatically.
        </div>
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-2" /> Add row
        </Button>
      </div>
    </div>
  );
}

function StepCard({ title, subtitle, children }) {
  return (
    <Card className="bg-white border border-slate-200/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-900">{title}</CardTitle>
        {subtitle ? <div className="text-xs text-slate-500 mt-1">{subtitle}</div> : null}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export default function InputForm({ inputs, onChange, onRun, onReset, isLoading }) {
  const safeInputs = inputs || {};

  // Provide sane defaults if user arrives with empty object
  const hydrated = useMemo(() => {
    const next = { ...(safeInputs || {}) };
    next.fund = next.fund || {};
    next.rates = next.rates || {};
    next.capital_programs = next.capital_programs || {};
    next.strategies = next.strategies || {};
    next.fees = next.fees || {};
    next.preferred_equity = next.preferred_equity || {};
    if (!Array.isArray(next.country_mix)) next.country_mix = [];
    return next;
  }, [safeInputs]);

  // Always keep hydrated object pushed to parent if missing structure
  // (No hooks needed; minimal pass-through)
  const set = (next) => onChange(next);

  return (
    <div className="space-y-4">
      {/* Horizontal step cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <StepCard
          title="Step 1 — Horizon"
          subtitle="Set development and operating period."
        >
          <NumberField inputs={hydrated} onChange={set} label="Development years" path="fund.dev_years" step={1} />
          <NumberField inputs={hydrated} onChange={set} label="Hold years (after development)" path="fund.hold_years" step={1} />
        </StepCard>

        <StepCard
          title="Step 2 — Equity stack"
          subtitle="Private equity + EIF public equity + optional junior equity."
        >
          <NumberField inputs={hydrated} onChange={set} label="Private equity [€]" path="fund.private_equity_total" step={1000000} />
          <NumberField inputs={hydrated} onChange={set} label="EIF public equity [€]" path="fund.eif_equity" step={1000000} />
          <NumberField
            inputs={hydrated}
            onChange={set}
            label="Junior equity % of total"
            path="fund.junior_equity_pct_of_total_equity"
            step={0.01}
            help="Junior equity absorbs first losses before common equity."
          />
        </StepCard>

        <StepCard
          title="Step 3 — EIB fund leverage"
          subtitle="EIB provides fund-level debt (D/(D+E))."
        >
          <NumberField inputs={hydrated} onChange={set} label="EIB debt share of total capital" path="capital_programs.eib_share_of_total_fund_capital" step={0.01} />
          <NumberField inputs={hydrated} onChange={set} label="EIB interest rate" path="rates.eib_rate" step={0.0025} />
        </StepCard>

        <StepCard
          title="Step 4 — Asset-level development debt"
          subtitle="Optional: add project debt during development (IO + bullet)."
        >
          <CheckboxField inputs={hydrated} onChange={set} label="Use asset dev debt" path="fund.use_asset_dev_debt" />
          <NumberField inputs={hydrated} onChange={set} label="Asset LTC" path="fund.asset_ltc" step={0.01} />
          <NumberField inputs={hydrated} onChange={set} label="Asset dev debt rate" path="rates.asset_dev_debt_rate" step={0.0025} />
        </StepCard>

        <StepCard
          title="Step 5 — Investor rotation"
          subtitle="Optional: impact investors exit after development."
        >
          <CheckboxField inputs={hydrated} onChange={set} label="Enable rotation" path="strategies.rotation_enabled" />
          <NumberField inputs={hydrated} onChange={set} label="Impact exit % (of private equity)" path="strategies.impact_exit_pct_of_private" step={0.01} />
          <NumberField inputs={hydrated} onChange={set} label="Buyout debt rate" path="rates.buyout_debt_rate" step={0.0025} />
          <SelectField
            inputs={hydrated}
            onChange={set}
            label="Rotation mode"
            path="strategies.rotation_mode"
            options={[
              { value: "Borrow buyout debt (CPM to exit)", label: "Borrow buyout debt (CPM to exit)" },
              { value: "Sell stake to patient capital (no debt)", label: "Sell stake to patient capital (no debt)" }
            ]}
          />
        </StepCard>

        <StepCard
          title="Step 6 — Fees & carry + Preferred"
          subtitle="Waterfall A: fees/carry. Waterfall B: preferred layer."
        >
          <NumberField inputs={hydrated} onChange={set} label="Founder / management fee" path="fees.founder_mgmt_fee_rate" step={0.005} />
          <NumberField inputs={hydrated} onChange={set} label="Bank / custody fee" path="fees.bank_fee_rate" step={0.0025} />
          <NumberField inputs={hydrated} onChange={set} label="Tokenization & distribution fee" path="fees.token_fee_rate" step={0.0025} />
          <NumberField inputs={hydrated} onChange={set} label="Carry rate" path="fees.promote_rate" step={0.05} />

          <div className="pt-2 border-t border-slate-100" />

          <CheckboxField inputs={hydrated} onChange={set} label="Enable preferred" path="preferred_equity.enabled" />
          <NumberField inputs={hydrated} onChange={set} label="Preferred amount [€]" path="preferred_equity.preferred_amount" step={1000000} />
          <NumberField inputs={hydrated} onChange={set} label="Preferred rate" path="preferred_equity.preferred_rate" step={0.01} />
        </StepCard>
      </div>

      <Card className="bg-white border border-slate-200/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900">Step 7 — Country Mix</CardTitle>
          <div className="text-xs text-slate-500 mt-1">
            This drives development value creation and stabilized affordable income yield by country.
          </div>
        </CardHeader>
        <CardContent>
          <CountryMixEditor inputs={hydrated} onChange={set} />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          onClick={() => onRun(hydrated)}
          disabled={isLoading}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Model
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onReset} disabled={isLoading}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
