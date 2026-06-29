import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ---------- formatters ---------- */

function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function fmtNumber(x, { max = 4 } = {}) {
  if (!isNum(x)) return String(x ?? "");
  return x.toLocaleString(undefined, { maximumFractionDigits: max });
}

function fmtPercent(x, { max = 2 } = {}) {
  if (!isNum(x)) return String(x ?? "");
  return `${(x * 100).toLocaleString(undefined, { maximumFractionDigits: max })}%`;
}

function fmtEUR(x, { max = 2 } = {}) {
  if (!isNum(x)) return String(x ?? "");
  return x.toLocaleString(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: max,
  });
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return JSON.stringify({ error: "Could not stringify object" }, null, 2);
  }
}

function getColumns(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const cols = new Set();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => cols.add(k)));
  return Array.from(cols);
}

function toNum(v) {
  const x = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(x) ? x : null;
}

/* ---------- descriptions ---------- */

const TABLE_DESCRIPTIONS = {
  Country_Input_Normalized:
    "Country assumptions used by the model. Weights are normalized to sum to 1.",
  Stabilisation:
    "Stabilisation by country: development value creation, stabilized value, and stabilized NOI based on affordable yield.",
  Core_Schedules:
    "Year-by-year schedule from NOI to distributable cash. Portfolio CF is before fund-level debt; Distributable to Equity is after paying EIB debt and any Buyout debt. DSCR columns show NOI coverage of each debt layer (operating years only).",
  WaterfallA_Summary:
    "Waterfall A summary: fees + carry applied to the common equity pool (Private + EIF + Junior).",
  WaterfallB_Summary:
    "Waterfall B summary: preferred equity paid coupon + principal, then residual common equity waterfall with fees/carry.",
  Cashflows_WF_A:
    "Cashflows under Waterfall A: founder fees/carry, common gross vs net, and stakeholder splits. Includes Cash-on-Cash series.",
  Cashflows_WF_B:
    "Cashflows under Waterfall B: founder + preferred + common net splits. Only meaningful if preferred is enabled.",
  Exit_Value_Components:
    "Audit table showing the components used to compute terminal value (reversion) under the chosen valuation method.",
};

/* ---------- small KPI cards (dashboard style) ---------- */

function KpiCard({ label, value, sub }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-semibold text-slate-800">{label}</CardTitle>
        {sub ? <div className="text-sm text-slate-500 mt-1 leading-snug">{sub}</div> : null}
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="text-lg font-semibold text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
}

/* ---------- table viewer with <=4 decimals ---------- */

function TableViewer({ tableName, rows }) {
  const columns = useMemo(() => getColumns(rows), [rows]);
  const [limit, setLimit] = useState(50);

  if (!Array.isArray(rows) || rows.length === 0) {
    return <div className="text-sm text-slate-500">No rows in this table.</div>;
  }

  const shown = rows.slice(0, limit);

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-600 leading-snug">
        {TABLE_DESCRIPTIONS[tableName] || "Intermediate table returned by the engine."}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Showing <b>{Math.min(limit, rows.length)}</b> of <b>{rows.length}</b> rows
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLimit(50)}>
            50
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLimit(200)}>
            200
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLimit(rows.length)}>
            All
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="text-left font-medium text-slate-700 px-3 py-2 whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, idx) => (
              <tr key={idx} className="border-t border-slate-100">
                {columns.map((c) => {
                  const v = r?.[c];
                  const display =
                    typeof v === "number"
                      ? fmtNumber(v, { max: 4 })
                      : v === null || v === undefined
                      ? ""
                      : String(v);
                  return (
                    <td key={c} className="px-3 py-2 whitespace-nowrap text-slate-800">
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-slate-400">Table: {tableName}</div>
    </div>
  );
}

/* ---------- simple line chart (SVG) with Year axis ---------- */

function LineChart({ title, desc, series, valueFormatter }) {
  const width = 900;
  const height = 240;
  const pad = 30;

  const all = (series || []).flatMap((s) => s.data || []);
  const finite = all.filter((x) => Number.isFinite(x));
  const minV = finite.length ? Math.min(...finite) : 0;
  const maxV = finite.length ? Math.max(...finite) : 1;
  const span = maxV - minV || 1;

  const n = series?.[0]?.data?.length || 0;

  function x(i) {
    if (n <= 1) return pad;
    return pad + (i * (width - 2 * pad)) / (n - 1);
  }
  function y(v) {
    return height - pad - ((v - minV) * (height - 2 * pad)) / span;
  }

  const paths = (series || []).map((s) => {
    const d = (s.data || [])
      .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`)
      .join(" ");
    return { label: s.label, d };
  });

  const yTicks = 4;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => minV + (i * span) / yTicks);

  let xTickIdx = [];
  if (n > 0) {
    const maxTicks = 6;
    const step = Math.max(1, Math.floor((n - 1) / (maxTicks - 1)));
    for (let i = 0; i < n; i += step) xTickIdx.push(i);
    if (xTickIdx[xTickIdx.length - 1] !== n - 1) xTickIdx.push(n - 1);
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-semibold text-slate-800">{title}</CardTitle>
        {desc ? <div className="text-sm text-slate-500 mt-1 leading-snug">{desc}</div> : null}
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="overflow-auto">
          <svg width={width} height={height} className="bg-white rounded-md border border-slate-200">
            {yTickVals.map((tv, i) => {
              const yy = y(tv);
              return (
                <g key={i}>
                  <line x1={pad} x2={width - pad} y1={yy} y2={yy} stroke="#e5e7eb" />
                  <text x={6} y={yy + 4} fontSize="11" fill="#64748b">
                    {valueFormatter ? valueFormatter(tv) : fmtNumber(tv, { max: 2 })}
                  </text>
                </g>
              );
            })}

            <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="#94a3b8" strokeWidth="1.5" />
            <line
              x1={pad}
              x2={width - pad}
              y1={height - pad}
              y2={height - pad}
              stroke="#94a3b8"
              strokeWidth="1.5"
            />

            {xTickIdx.map((idx) => {
              const xx = x(idx);
              return (
                <g key={idx}>
                  <line x1={xx} x2={xx} y1={height - pad} y2={height - pad + 6} stroke="#94a3b8" />
                  <text
                    x={xx}
                    y={height - pad + 18}
                    fontSize="11"
                    fill="#64748b"
                    textAnchor="middle"
                  >
                    {idx}
                  </text>
                </g>
              );
            })}
            <text x={width / 2} y={height - 4} fontSize="11" fill="#64748b" textAnchor="middle">
              Year
            </text>

            {paths.map((p, i) => (
              <path
                key={p.label}
                d={p.d}
                fill="none"
                stroke={i === 0 ? "#0f172a" : "#64748b"}
                strokeWidth="2"
              />
            ))}

            <g>
              {paths.map((p, i) => (
                <g key={p.label} transform={`translate(${pad + i * 180}, ${pad - 12})`}>
                  <rect width="10" height="10" fill={i === 0 ? "#0f172a" : "#64748b"} />
                  <text x="14" y="10" fontSize="11" fill="#0f172a">
                    {p.label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Decision Tree SVG (Year 0) ---------- */

function DecisionTree({ scalars }) {
  const E = scalars?.common_equity0 ?? null;
  const D = scalars?.eib_fund_debt0 ?? null;
  const total = scalars?.deployable_capital_E_plus_D ?? null;

  if (!isNum(E) || !isNum(D) || !isNum(total)) return null;

  const box = (x, y, w, h, title, value) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="14" fill="#ffffff" stroke="#cbd5e1" />
      <text x={x + 14} y={y + 26} fontSize="13" fill="#0f172a" fontWeight="600">
        {title}
      </text>
      <text x={x + 14} y={y + 50} fontSize="14" fill="#0f172a">
        {value}
      </text>
    </g>
  );

  return (
    <Card className="border-slate-200">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-semibold text-slate-800">
          Step 8 — Decision Tree (Fund overview)
        </CardTitle>
        <div className="text-sm text-slate-500 mt-1 leading-snug">
          Visual summary of Year 0 sources of capital: common equity + EIB fund debt = deployable capital.
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="overflow-auto">
          <svg width="900" height="260" className="bg-white rounded-md border border-slate-200">
            {box(310, 20, 280, 70, "Deployable capital (E + D)", fmtEUR(total, { max: 2 }))}

            <line x1="450" y1="90" x2="450" y2="120" stroke="#94a3b8" strokeWidth="2" />
            <polygon points="450,128 444,118 456,118" fill="#94a3b8" />

            <line x1="450" y1="128" x2="250" y2="150" stroke="#94a3b8" strokeWidth="2" />
            <line x1="450" y1="128" x2="650" y2="150" stroke="#94a3b8" strokeWidth="2" />

            {box(140, 155, 320, 70, "Common equity (Private + EIF + Junior)", fmtEUR(E, { max: 2 }))}
            {box(520, 155, 240, 70, "EIB fund debt", fmtEUR(D, { max: 2 }))}

            <text x="312" y="118" fontSize="11" fill="#64748b">
              Year 0
            </text>
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- chart builders from returned tables ---------- */

function seriesFromTable(rows, colName) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const out = [];
  for (const r of rows) {
    const v = toNum(r?.[colName]);
    out.push(v ?? 0);
  }
  return out;
}

function hasMeaningfulPreferred(scalars) {
  const amt = scalars?.preferred_amount;
  return isNum(amt) && amt > 0;
}

/* ---------- per-table charts (Streamlit-like) ---------- */

function ChartsForTable({ tableName, tables, series, scalars }) {
  const rows = tables?.[tableName] || [];

  if (tableName === "Core_Schedules") {
    const noi = seriesFromTable(rows, "NOI [€]") || null;
    const eibPay = seriesFromTable(rows, "EIB Payment [€]") || null;
    const buyoutPay = seriesFromTable(rows, "Buyout Payment [€]") || null;
    const dscrEib = seriesFromTable(rows, "DSCR (EIB)") || null;
    const dscrTot = seriesFromTable(rows, "DSCR (Total Fund Debt)") || null;

    const dist = seriesFromTable(rows, "Distributable to Equity [€]") || null;
    const rev = seriesFromTable(rows, "Reversion [€]") || null;

    if (!noi || !dist) return null;

    return (
      <div className="space-y-4">
        <LineChart
          title="Core schedule: NOI and distributable cash"
          desc="NOI ramps post-development; distributable cash reflects EIB debt service, any buyout debt, and reversion."
          series={[
            { label: "NOI", data: noi },
            { label: "Distributable to equity", data: dist },
          ]}
          valueFormatter={(v) => fmtEUR(v, { max: 0 })}
        />

        {(eibPay || buyoutPay) ? (
          <LineChart
            title="Fund-level debt service layers"
            desc="EIB debt is the core fund-level leverage. Buyout debt only exists if the fund borrows to buy out Impact investors at the end of development."
            series={[
              ...(eibPay ? [{ label: "EIB Payment", data: eibPay }] : []),
              ...(buyoutPay ? [{ label: "Buyout Payment", data: buyoutPay }] : []),
            ]}
            valueFormatter={(v) => fmtEUR(v, { max: 0 })}
          />
        ) : null}

        {(dscrEib || dscrTot) ? (
          <LineChart
            title="Debt coverage (DSCR)"
            desc="DSCR = NOI / Debt Service. Compare coverage of EIB alone vs total fund-level debt (EIB + Buyout)."
            series={[
              ...(dscrEib ? [{ label: "DSCR (EIB)", data: dscrEib }] : []),
              ...(dscrTot ? [{ label: "DSCR (Total Fund Debt)", data: dscrTot }] : []),
            ]}
            valueFormatter={(v) => fmtNumber(v, { max: 2 })}
          />
        ) : null}

        {rev ? (
          <LineChart
            title="Terminal value (reversion)"
            desc="If the fund sells at exit, the reversion value appears in the final year."
            series={[{ label: "Reversion", data: rev }]}
            valueFormatter={(v) => fmtEUR(v, { max: 0 })}
          />
        ) : null}
      </div>
    );
  }

  if (tableName === "Cashflows_WF_A") {
    const cocGross =
      seriesFromTable(rows, "CoC Gross") || (Array.isArray(series?.coc_gross_A) ? series.coc_gross_A : null);
    const cocNet =
      seriesFromTable(rows, "CoC Net") || (Array.isArray(series?.coc_net_A) ? series.coc_net_A : null);

    const priv = seriesFromTable(rows, "Private Net CF [€]") || null;
    const eif = seriesFromTable(rows, "EIF Net CF [€]") || null;
    const jun = seriesFromTable(rows, "Junior Net CF [€]") || null;
    const founder = seriesFromTable(rows, "Founder CF [€]") || null;

    return (
      <div className="space-y-4">
        {cocGross && cocNet ? (
          <LineChart
            title="Cash-on-Cash profile (Waterfall A)"
            desc="Gross vs net Cash-on-Cash: net includes management fees and carry on the common equity pool."
            series={[
              { label: "CoC Gross (A)", data: cocGross },
              { label: "CoC Net (A)", data: cocNet },
            ]}
            valueFormatter={(v) => fmtPercent(v, { max: 1 })}
          />
        ) : null}

        {priv && eif && jun ? (
          <LineChart
            title="Net cashflows by tranche (Waterfall A)"
            desc="Distribution of net cashflows between Private, EIF, and Junior equity under first-loss mechanics."
            series={[
              { label: "Private", data: priv },
              { label: "EIF", data: eif },
              { label: "Junior", data: jun },
            ]}
            valueFormatter={(v) => fmtEUR(v, { max: 0 })}
          />
        ) : null}

        {founder ? (
          <LineChart
            title="Founder cashflows (fees + carry, A)"
            desc="Annual management fees plus terminal carry where applicable."
            series={[{ label: "Founder", data: founder }]}
            valueFormatter={(v) => fmtEUR(v, { max: 0 })}
          />
        ) : null}
      </div>
    );
  }

  if (tableName === "Cashflows_WF_B") {
    if (!hasMeaningfulPreferred(scalars)) {
      return (
        <Card className="border-slate-200">
          <CardContent className="py-4 text-sm text-slate-600">
            Preferred equity amount is currently set to €0. Increase it in the inputs above to see Waterfall B cashflow profiles.
          </CardContent>
        </Card>
      );
    }

    const pref =
      seriesFromTable(rows, "Preferred CF [€]") ||
      (Array.isArray(series?.preferred_cf_B) ? series.preferred_cf_B : null);
    const common =
      seriesFromTable(rows, "Common Net CF [€]") ||
      (Array.isArray(series?.common_net_cf_B) ? series.common_net_cf_B : null);
    const founder =
      seriesFromTable(rows, "Founder CF [€]") ||
      (Array.isArray(series?.founder_cf_B) ? series.founder_cf_B : null);

    return (
      <div className="space-y-4">
        {pref ? (
          <LineChart
            title="Preferred cashflows (coupon + principal)"
            desc="Preferred equity receives a fixed coupon during operating years and principal at exit."
            series={[{ label: "Preferred", data: pref }]}
            valueFormatter={(v) => fmtEUR(v, { max: 0 })}
          />
        ) : null}

        {common ? (
          <LineChart
            title="Common residual (net) after preferred"
            desc="Residual cashflows available to common equity after fees and preferred payments."
            series={[{ label: "Common (net, B)", data: common }]}
            valueFormatter={(v) => fmtEUR(v, { max: 0 })}
          />
        ) : null}

        {founder ? (
          <LineChart
            title="Founder cashflows (fees + carry, B)"
            desc="Fees on the chosen base plus carry charged at exit under Waterfall B."
            series={[{ label: "Founder", data: founder }]}
            valueFormatter={(v) => fmtEUR(v, { max: 0 })}
          />
        ) : null}
      </div>
    );
  }

  return null;
}

/* ---------- section wrapper (Streamlit-like blocks) ---------- */

function Section({ title, subtitle, defaultOpen = true, children }) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="text-sm text-slate-500 mt-1 leading-snug">{subtitle}</div> : null}
        </div>
        <div className="text-xs text-slate-400">Toggle</div>
      </summary>
      <div className="px-4 pb-4 pt-1">{children}</div>
    </details>
  );
}

/* ---------- main panel (PDF-style narrative, Steps 5–8) ---------- */

export default function ResultsPanel({ results, onSave, isSaving }) {
  const [showRaw, setShowRaw] = useState(false);

  const scalars = results?.scalars || {};
  const tables = results?.tables || {};
  const series = results?.series || {};
  const warnings = results?.warnings || [];

  const hasResults =
    results && (Object.keys(scalars).length > 0 || Object.keys(tables).length > 0 || Object.keys(series).length > 0);

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="text-[13px] uppercase tracking-wide text-slate-500">
            Legacy Fund — European Affordable Housing Investment Fund
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Results (Steps 5–8)</h2>
            {results?.model_id && <Badge variant="secondary">{results.model_id}</Badge>}
            {results?.engine_version && <Badge variant="outline">engine {results.engine_version}</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setShowRaw((s) => !s)} variant="outline">
            {showRaw ? "Hide Raw JSON" : "Show Raw JSON"}
          </Button>
          <Button onClick={onSave} disabled={!results || isSaving} variant="outline">
            {isSaving ? "Saving..." : "Save Scenario"}
          </Button>
        </div>
      </div>

      {!hasResults && (
        <Card className="border-slate-200">
          <CardContent className="py-6 text-sm text-slate-500">
            Run the benchmark in Steps 1–4 (capital structure, leverage, country mix, and strategies) to see the results narrative here.
          </CardContent>
        </Card>
      )}

      {/* warnings */}
      {warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-amber-800">Model warnings</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3 text-sm text-amber-900 space-y-1">
            {warnings.map((w, i) => (
              <div key={i}>
                <b>{w.code}</b>: {w.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* narrative card */}
      {hasResults ? (
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
              <b>Step 5</b> shows the gross economics: total deployable capital, stabilized NOI, and gross IRR/MOIC for the common equity pool <i>before</i> fees, carry, or preferred.
              The stabilisation and schedule tables let you audit the path from Year 0 capital to Year T reversion.
            </p>
            <p>
              <b>Case A — Waterfall A</b>: no preferred equity. Common equity shares net cashflows after fees/carry. Junior absorbs first losses.
            </p>
            <p>
              <b>Case B — Waterfall B</b>: preferred equity sits above common. Preferred receives coupon + principal first; the residual goes to the common waterfall.
            </p>

            {/* === NEW: glossary / definitions === */}
            <p>
              <b>Key cashflow definitions (plain language)</b><br />
              <b>NOI</b> is stabilized net operating income from the rental portfolio (here: affordable rents), grown by inflation.<br />
              <b>Portfolio CF</b> is the asset-side cashflow: NOI minus any asset-level debt service (if enabled) plus terminal value (reversion).<br />
              <b>Distributable to Equity</b> is what remains after paying fund-level debt (EIB + any Buyout debt). This is the cash available to equity holders before applying fees and waterfall logic.
            </p>

            <p>
              <b>Debt service coverage (DSCR)</b><br />
              We report DSCR as <b>NOI / Debt Service</b> during operating years (post-development). This is a standard credit metric used by lenders and investment committees.<br />
              In this model we show DSCR separately for the <b>EIB fund loan</b>, the <b>Buyout (rotation) debt</b>, and <b>total fund-level debt</b>.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* ===== Step 5 — dashboard ===== */}
      {hasResults ? (
        <Card className="border-slate-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Step 5 — Results dashboard (gross, pre-fees & pre-preferred)
            </CardTitle>
            <div className="text-sm text-slate-500 mt-1 leading-snug">
              Gross fund metrics based on the capital structure and country mix selected in Steps 1–4.
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Total equity (Common pool)" sub="Private + EIF + Junior equity at Year 0." value={fmtEUR(scalars.common_equity0, { max: 0 })} />
              <KpiCard label="EIB fund debt" sub="Fund-level leverage set by D / (D + E)." value={fmtEUR(scalars.eib_fund_debt0, { max: 0 })} />
              <KpiCard label="Deployable capital (E + D)" sub="Total development capital available at Year 0." value={fmtEUR(scalars.deployable_capital_E_plus_D, { max: 0 })} />
              <KpiCard label="Horizon" sub="Development + operating years." value={`${fmtNumber(scalars.total_horizon, { max: 0 })} years`} />
              <KpiCard label="IRR (Common, gross)" sub="Gross IRR for Common equity, before fees/carry." value={fmtPercent(scalars.irr_gross_A, { max: 2 })} />
              <KpiCard label="MOIC (Common, gross)" sub="Gross multiple on invested Common equity." value={`${fmtNumber(scalars.moic_gross_A, { max: 2 })}x`} />
              <KpiCard label="Avg CoC (gross)" sub="Average gross Cash-on-Cash during operating years." value={fmtPercent(scalars.avg_coc_gross_A, { max: 2 })} />
              <KpiCard label="Stabilised NOI (affordable)" sub="Year-1 stabilised NOI at the end of development." value={fmtEUR(scalars.total_noi_stab, { max: 0 })} />
              <KpiCard label="CoC (Year 1 post-dev, gross)" sub="Year-1 stabilised NOI at the end of development." value={fmtPercent(scalars.coc_year1_gross_A, { max: 0 })} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ===== Step 5b ===== */}
      {hasResults ? (
        <Section
          title="Step 5b — Stabilisation by country (values & NOI)"
          subtitle="Breakdown of development cost, stabilised asset value, and stabilised affordable NOI by country."
          defaultOpen={false}
        >
          <TableViewer tableName="Stabilisation" rows={tables?.Stabilisation || []} />
        </Section>
      ) : null}

      {/* ===== Step 5c ===== */}
      {hasResults ? (
        <Section
          title="Step 5c — Full schedules & cashflows (audit)"
          subtitle="Year-by-year path from NOI and debt service to distributable cash and terminal value."
          defaultOpen={false}
        >
          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold text-slate-800">How debt works in this model</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4 text-sm text-slate-700 space-y-2 leading-snug">
                <p>
                  <b>Portfolio CF</b> is the project-level cashflow before fund-level financing: it starts from NOI, subtracts any asset development debt costs, and adds terminal reversion (if enabled).
                </p>
                <p>
                  <b>EIB Payment</b> is paid at the fund level (interest-only during development, then amortising during hold). After paying EIB, the remaining cash is what equity can potentially receive.
                </p>
                <p>
                  <b>Buyout Payment</b> only exists if the fund borrows to buy out Impact investors at the end of development. In that case, buyout debt service is paid from operating cashflows alongside EIB debt service.
                </p>
                <p>
                  <b>DSCR</b> shows coverage: DSCR = NOI / Debt Service. Compare EIB-only coverage vs total fund-level debt (EIB + Buyout).
                </p>
              </CardContent>
            </Card>

            {/* === NEW: Exit valuation explainer === */}
            <Card className="border-slate-200">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold text-slate-800">How exit value and cap rates work here</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4 text-sm text-slate-700 space-y-2 leading-snug">
                <p>
                  The exit value (shown as <b>Reversion</b> in the last year of <b>Core Schedules</b>) is computed using a cap-rate approach, but the interpretation depends on the affordability commitment.
                </p>

                <p>
                  <b>Important:</b> in this fund, assets are kept at <b>affordable rents</b> for the affordability period (here: <b>measured from stabilisation</b>, e.g., 20 years post-development). After the restriction expires, rents can revert to <b>market rents</b>, creating upside.
                </p>

                <p>
                  There are two investor-friendly ways to model this:
                  <br />• <b>Simple exit cap rate</b>: you enter an exit cap rate that is assumed to already reflect the fact that the asset is still affordable at exit (i.e., the buyer prices in restricted rents). If you also apply a “market uplift”, you are effectively assuming some market reversion at exit.
                  <br />• <b>Two-stage affordability → market</b>: the model treats the exit as a buyer purchasing a restricted-income asset, but with an embedded option: after the restriction period ends, income steps up toward market rents, and the terminal value is based on a market cap rate. This explicitly isolates the <b>upside after affordability</b>.
                </p>

                <p>
                  <b>How to interpret “Exit cap rate after the 20-year hold”</b>:
                  If the fund exits while the asset is still under affordability restrictions, the exit cap rate should be interpreted as an <b>affordable cap rate</b> (restricted NOI / price). The market upside then comes from what happens <i>after</i> restrictions end — this is what the two-stage method captures.
                </p>

                <p>
                  Practical guidance used by many investment teams:
                  <br />• Use the <b>two-stage method</b> when you want the model to explicitly show the value of the “market rent reversion” upside.
                  <br />• Use the <b>simple exit cap</b> when you already have comps/valuation guidance for trading restricted-income affordable portfolios.
                </p>
              </CardContent>
            </Card>

            {/* === NEW: Buyout / rotation diagnostics === */}
            <Card className="border-slate-200">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold text-slate-800">Rotation / buyout option — what should change</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4 text-sm text-slate-700 space-y-2 leading-snug">
                <p>
                  The “buyout” (rotation) option represents <b>patient capital buying out an impact investor’s equity stake</b> at the end of development. In the debt-financed version, the fund borrows “buyout debt” and uses the proceeds to pay the exiting investor.
                </p>
                <p>
                  <b>Why the development-year cashflow can look unchanged:</b><br />
                  In a debt-financed buyout, the model has a cash inflow (debt proceeds) and an equal cash outflow (buyout payment) in the same year. Net impact that year is approximately zero.
                  The economic impact appears later via <b>Buyout Payment</b> (debt service) reducing distributable cash during the operating years.
                </p>
                <p>
                  <b>How to verify it is working:</b><br />
                  Open <b>Core Schedules</b> and check the column <b>Buyout Payment [€]</b>. If it is all zeros, the buyout is not active (inputs not being applied). If it shows a payment stream post-development, the buyout is active and it should reduce distributable cash and equity returns.
                </p>
              </CardContent>
            </Card>

            {/* === NEW: Exit value components table (if engine provides it) === */}
            {Array.isArray(tables?.Exit_Value_Components) && tables.Exit_Value_Components.length > 0 ? (
              <Section
                title="Exit valuation details (audit)"
                subtitle="Components used to compute the terminal reversion value."
                defaultOpen={false}
              >
                <TableViewer tableName="Exit_Value_Components" rows={tables?.Exit_Value_Components || []} />
              </Section>
            ) : null}

            <TableViewer tableName="Core_Schedules" rows={tables?.Core_Schedules || []} />
            <ChartsForTable tableName="Core_Schedules" tables={tables} series={series} scalars={scalars} />

            <TableViewer tableName="Cashflows_WF_A" rows={tables?.Cashflows_WF_A || []} />
            <ChartsForTable tableName="Cashflows_WF_A" tables={tables} series={series} scalars={scalars} />
          </div>
        </Section>
      ) : null}

      {/* ===== Step 6 ===== */}
      {hasResults ? (
        <Card className="border-slate-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Step 6 — Waterfall A (Case A: Common equity-only structure)
            </CardTitle>
            <div className="text-sm text-slate-500 mt-1 leading-snug">
              Case A applies management fees and carry on the Common equity pool, with no preferred equity. Junior absorbs first losses; the remaining cashflows are shared pro-rata between Private and EIF.
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4 space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <KpiCard label="IRR (Common, net — Case A)" sub="Net of management fees and carry, before preferred." value={fmtPercent(scalars.irr_common_net_A, { max: 2 })} />
              <KpiCard label="MOIC (Common, net — Case A)" sub="Net multiple on Common equity under Waterfall A." value={`${fmtNumber(scalars.moic_common_net_A, { max: 2 })}x`} />
              <KpiCard label="Avg CoC (net — Case A)" sub="Average net Cash-on-Cash for Common equity during operating years." value={fmtPercent(scalars.avg_coc_net_A, { max: 2 })} />
            </div>

            <TableViewer tableName="WaterfallA_Summary" rows={tables?.WaterfallA_Summary || []} />
          </CardContent>
        </Card>
      ) : null}

      {/* ===== Detailed WF A ===== */}
      {hasResults ? (
        <Section
          title="Detailed cashflows — Waterfall A (Founder + Private + EIF + Junior)"
          subtitle="Detailed time series for founder fees/carry, gross vs net Common cashflows, and the Private/EIF/Junior splits."
          defaultOpen={false}
        >
          <div className="space-y-6">
            <TableViewer tableName="Cashflows_WF_A" rows={tables?.Cashflows_WF_A || []} />
            <ChartsForTable tableName="Cashflows_WF_A" tables={tables} series={series} scalars={scalars} />
          </div>
        </Section>
      ) : null}

      {/* ===== Step 7 ===== */}
      {hasResults ? (
        <Card className="border-slate-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-slate-800">
              Step 7 — Waterfall B (Case B: Preferred + Common equity structure)
            </CardTitle>
            <div className="text-sm text-slate-500 mt-1 leading-snug">
              Case B adds a Preferred equity layer on top of Common equity. Preferred receives coupon and principal first; the residual cashflows then go through the same fee/carry and first-loss mechanics as in Case A.
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4 space-y-4">
            {!hasMeaningfulPreferred(scalars) ? (
              <div className="text-sm text-slate-600">
                Preferred equity is currently set to <b>€0</b>. Increase the Preferred amount in the inputs above to activate Case B and see the Waterfall B metrics and cashflows.
              </div>
            ) : Array.isArray(tables?.WaterfallB_Summary) && tables.WaterfallB_Summary.length === 0 ? (
              <div className="text-sm text-slate-600">
                Preferred equity is enabled in the inputs, but the engine returned an empty <b>WaterfallB_Summary</b> table for this scenario. Double-check the preferred settings and rerun the model.
              </div>
            ) : (
              <>
                <TableViewer tableName="WaterfallB_Summary" rows={tables?.WaterfallB_Summary || []} />

                <Section
                  title="Detailed cashflows — Waterfall B (Founder + Preferred + Common)"
                  subtitle="Preferred coupon and principal, residual Common equity cashflows, and founder fees/carry under Case B."
                  defaultOpen={false}
                >
                  <div className="space-y-6">
                    <TableViewer tableName="Cashflows_WF_B" rows={tables?.Cashflows_WF_B || []} />
                    <ChartsForTable tableName="Cashflows_WF_B" tables={tables} series={series} scalars={scalars} />
                  </div>
                </Section>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* ===== Step 8 ===== */}
      {hasResults ? <DecisionTree scalars={scalars} /> : null}

      {/* Raw JSON optional */}
      {showRaw && results ? (
        <Card className="border-slate-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-slate-800">Raw JSON (advanced)</CardTitle>
            <div className="text-sm text-slate-500 mt-1 leading-snug">
              Full engine response for debugging and audit. Most users can ignore this section.
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
              <pre className="text-xs p-4">{safeStringify(results)}</pre>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
