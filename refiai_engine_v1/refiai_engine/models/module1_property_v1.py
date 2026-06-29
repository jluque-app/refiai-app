from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple
import math


# ---------------------------
# Utilities
# ---------------------------

def _to_float(x: Any, default: float) -> float:
    try:
        if x is None:
            return float(default)
        if isinstance(x, (int, float)):
            v = float(x)
            return v
        if isinstance(x, str):
            s = x.strip().replace(",", "")
            if s.endswith("%"):
                return float(s[:-1]) / 100.0
            return float(s)
        return float(x)
    except Exception:
        return float(default)


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _is_finite_number(x: Any) -> bool:
    return isinstance(x, (int, float)) and math.isfinite(float(x))


def irr(cashflows: List[float], guess: float = 0.10) -> float:
    """
    Simple IRR solver via Newton-Raphson with fallbacks.
    Deterministic, no external deps. Returns NaN if it cannot converge.
    """
    # Guard
    if not cashflows or all(abs(cf) < 1e-12 for cf in cashflows):
        return float("nan")
    if not (any(cf < 0 for cf in cashflows) and any(cf > 0 for cf in cashflows)):
        return float("nan")

    def npv(r: float) -> float:
        return sum(cf / ((1.0 + r) ** t) for t, cf in enumerate(cashflows))

    def d_npv(r: float) -> float:
        return sum(-t * cf / ((1.0 + r) ** (t + 1)) for t, cf in enumerate(cashflows))

    r = guess
    # Newton steps
    for _ in range(100):
        if r <= -0.999999:
            r = -0.9
        f = npv(r)
        df = d_npv(r)
        if abs(f) < 1e-8:
            return r
        if abs(df) < 1e-12:
            break
        r_new = r - f / df
        if abs(r_new - r) < 1e-10:
            return r_new
        r = r_new

    # Fallback: bisection on a broad interval
    lo, hi = -0.9, 5.0
    f_lo, f_hi = npv(lo), npv(hi)
    if (f_lo > 0 and f_hi > 0) or (f_lo < 0 and f_hi < 0):
        return float("nan")

    for _ in range(200):
        mid = (lo + hi) / 2.0
        f_mid = npv(mid)
        if abs(f_mid) < 1e-8:
            return mid
        if (f_lo <= 0 and f_mid <= 0) or (f_lo >= 0 and f_mid >= 0):
            lo, f_lo = mid, f_mid
        else:
            hi, f_hi = mid, f_mid
    return mid


@dataclass(frozen=True)
class Inputs:
    purchase_price: float
    year1_noi: float
    noi_growth: float
    hold_years: int
    exit_cap_rate: float
    sell_cost: float
    discount_rate: float  # informational; IRR is computed from cashflows
    cap_rate: float       # informational; used for "direct cap value"

    @staticmethod
    def from_payload(payload: Dict[str, Any]) -> Tuple["Inputs", List[Dict[str, Any]]]:
        warnings: List[Dict[str, Any]] = []

        purchase_price = _to_float(payload.get("purchase_price"), 10_000_000.0)
        year1_noi = _to_float(payload.get("year1_noi"), 600_000.0)

        noi_growth = _to_float(payload.get("noi_growth"), 0.02)
        hold_years_raw = payload.get("hold_years", 10)
        try:
            hold_years = int(float(hold_years_raw))
        except Exception:
            hold_years = 10

        exit_cap_rate = _to_float(payload.get("exit_cap_rate"), 0.055)
        sell_cost = _to_float(payload.get("sell_cost"), 0.02)

        discount_rate = _to_float(payload.get("discount_rate"), 0.08)
        cap_rate = _to_float(payload.get("cap_rate"), 0.06)

        # Educational guardrails
        if purchase_price <= 0:
            warnings.append({
                "code": "PURCHASE_PRICE_NONPOSITIVE",
                "message": "purchase_price must be > 0; using default 10,000,000.",
                "severity": "warning",
                "context": {"purchase_price": purchase_price},
            })
            purchase_price = 10_000_000.0

        if year1_noi <= 0:
            warnings.append({
                "code": "NOI_NONPOSITIVE",
                "message": "year1_noi must be > 0; using default 600,000.",
                "severity": "warning",
                "context": {"year1_noi": year1_noi},
            })
            year1_noi = 600_000.0

        hold_years = int(_clamp(float(hold_years), 1, 50))
        exit_cap_rate = _clamp(exit_cap_rate, 0.02, 0.20)
        cap_rate = _clamp(cap_rate, 0.02, 0.20)
        sell_cost = _clamp(sell_cost, 0.0, 0.10)
        discount_rate = _clamp(discount_rate, 0.0, 0.50)
        noi_growth = _clamp(noi_growth, -0.20, 0.30)

        return Inputs(
            purchase_price=purchase_price,
            year1_noi=year1_noi,
            noi_growth=noi_growth,
            hold_years=hold_years,
            exit_cap_rate=exit_cap_rate,
            sell_cost=sell_cost,
            discount_rate=discount_rate,
            cap_rate=cap_rate,
        ), warnings


def _build_proforma(inp: Inputs) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    noi = inp.year1_noi
    for y in range(1, inp.hold_years + 1):
        if y > 1:
            noi *= (1.0 + inp.noi_growth)
        rows.append({
            "Year": y,
            "NOI": noi,
        })
    return rows


def _build_cashflows(inp: Inputs, proforma: List[Dict[str, Any]]) -> Tuple[List[float], List[Dict[str, Any]]]:
    """
    Cashflow convention:
    - Year 0: -purchase_price
    - Years 1..N-1: NOI
    - Year N: NOI + net sale proceeds
    """
    n = inp.hold_years
    cashflows: List[float] = [-(inp.purchase_price)]
    rows: List[Dict[str, Any]] = [{"Year": 0, "Cashflow": cashflows[0], "NOI": 0.0, "Net_Sale": 0.0}]

    # NOI years 1..N
    noi_by_year = [r["NOI"] for r in proforma]
    for y in range(1, n + 1):
        noi = float(noi_by_year[y - 1])
        cashflows.append(noi)
        rows.append({"Year": y, "Cashflow": noi, "NOI": noi, "Net_Sale": 0.0})

    # Terminal value at end of year N based on NOI_(N+1)
    noi_n = float(noi_by_year[-1])
    noi_n1 = noi_n * (1.0 + inp.noi_growth)
    gross_sale = noi_n1 / inp.exit_cap_rate
    net_sale = gross_sale * (1.0 - inp.sell_cost)

    # Add to last year
    cashflows[-1] += net_sale
    rows[-1]["Cashflow"] = cashflows[-1]
    rows[-1]["Net_Sale"] = net_sale

    return cashflows, rows


def run(inputs: Dict[str, Any]) -> Dict[str, Any]:
    inp, warnings = Inputs.from_payload(inputs or {})

    # Core tables
    inputs_table = [{
        "purchase_price": inp.purchase_price,
        "year1_noi": inp.year1_noi,
        "noi_growth": inp.noi_growth,
        "hold_years": inp.hold_years,
        "cap_rate": inp.cap_rate,
        "exit_cap_rate": inp.exit_cap_rate,
        "sell_cost": inp.sell_cost,
        "discount_rate": inp.discount_rate,
    }]

    proforma = _build_proforma(inp)
    cashflows, cashflow_table = _build_cashflows(inp, proforma)

    # KPIs
    direct_cap_value = inp.year1_noi / inp.cap_rate
    irr_value = irr(cashflows, guess=0.10)

    total_in = -sum(cf for cf in cashflows if cf < 0)
    total_out = sum(cf for cf in cashflows if cf > 0)
    moic = (total_out / total_in) if total_in > 0 else float("nan")

    # Extra summary table
    valuation_summary = [{
        "Direct_Cap_Value_(Y1_NOI/Cap)": direct_cap_value,
        "Purchase_Price": inp.purchase_price,
        "Implied_GoingIn_Cap_(Y1_NOI/Price)": (inp.year1_noi / inp.purchase_price),
        "Hold_Years": inp.hold_years,
        "Exit_Cap_Rate": inp.exit_cap_rate,
        "Sell_Cost": inp.sell_cost,
        "IRR": irr_value,
        "MOIC": moic,
        "Total_Distributions": total_out,
    }]

    # Series for plotting later
    series = {
        "noi": [0.0] + [float(r["NOI"]) for r in proforma],
        "cashflow": cashflows,
    }

    # Defensive JSON safety: make sure no NaN/Inf leaks (FastAPI can fail otherwise)
    def _clean(x: Any) -> Any:
        if isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
            return None
        if isinstance(x, dict):
            return {k: _clean(v) for k, v in x.items()}
        if isinstance(x, list):
            return [_clean(v) for v in x]
        return x

    out = {
        "warnings": warnings,
        "scalars": {
            "purchase_price": inp.purchase_price,
            "year1_noi": inp.year1_noi,
            "direct_cap_value": direct_cap_value,
            "irr": irr_value,
            "moic": moic,
        },
        "tables": {
            "Inputs": inputs_table,
            "Proforma_NOI": proforma,
            "Cashflows": cashflow_table,
            "Valuation_Summary": valuation_summary,
        },
        "series": series,
    }
    return _clean(out)
