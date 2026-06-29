from __future__ import annotations

"""
Legacy Fund (v1) — deterministic engine

This module returns intermediate tables so the app can explain each step.

Key ideas
---------
The fund deploys capital in Year 0 into affordable housing development.

Cashflow path (high level):

    NOI (post-development)
      - Asset-level debt service (optional stabilized mortgage)
      - Dev debt IO + bullet (optional dev-only debt)
      + Terminal value at exit (if market sale enabled)
    = Portfolio CF (asset-side)
      - EIB fund debt service (fund-level leverage)
      - Buyout debt service (if fund borrows to buy out impact capital)
    = Distributable to Total Equity (fund-side)

Then we apply:
  - Management fees
  - Optional preferred equity layer (Waterfall B)
  - A true cumulative waterfall (European-style):
        return of capital -> preferred return/hurdle -> GP catch-up -> promote split
  - First-loss allocation inside the common pool (Junior first-loss)

All formulas are annual (Year 0..Year T).
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Tuple

import pandas as pd

from refiai_engine_api.schemas_v1 import WarningMsg


# =============================================================================
# Small parsing helpers (IMPORTANT for Base44 inputs)
# =============================================================================

def as_float(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except Exception:
        return float(default)


def as_pct(x: Any, default: float = 0.0) -> float:
    """
    Accepts either:
      - decimals (0.30) OR
      - percent inputs (30)
    and returns a decimal (0.30).
    """
    v = as_float(x, default)
    return v / 100.0 if v > 1.0 else v


# =============================================================================
# Utilities: IRR + PMT (Excel-like intent)
# =============================================================================

@dataclass
class CashFlow:
    t: int
    amount: float


def _npv(rate: float, cfs: List[CashFlow]) -> float:
    return sum(cf.amount / ((1.0 + rate) ** cf.t) for cf in cfs)


def _d_npv(rate: float, cfs: List[CashFlow]) -> float:
    return sum(-cf.t * cf.amount / ((1.0 + rate) ** (cf.t + 1)) for cf in cfs if cf.t != 0)


def irr(
    cfs: List[CashFlow],
    guess: float = 0.10,
    max_iter: int = 100,
    tol: float = 1e-10,
    max_rate: float = 5.0,
) -> float:
    """Robust annual IRR (Newton with bisection fallback)."""
    if not cfs:
        return float("nan")
    has_neg = any(cf.amount < 0 for cf in cfs)
    has_pos = any(cf.amount > 0 for cf in cfs)
    if not (has_neg and has_pos):
        return float("nan")

    lo = -0.9999
    hi = max_rate
    r = min(max(guess, lo + 1e-6), hi)

    for _ in range(max_iter):
        f = _npv(r, cfs)
        if abs(f) < tol:
            return r
        df = _d_npv(r, cfs)
        if df == 0 or not (df == df):
            break
        r2 = r - f / df
        if not (lo < r2 < hi):
            break
        r = r2

    # bisection fallback
    f_lo = _npv(lo, cfs)
    f_hi = _npv(hi, cfs)
    if f_lo == 0:
        return lo
    if f_hi == 0:
        return hi
    if f_lo * f_hi > 0:
        return r

    a, b = lo, hi
    fa, fb = f_lo, f_hi
    for _ in range(max_iter * 5):
        m = 0.5 * (a + b)
        fm = _npv(m, cfs)
        if abs(fm) < tol:
            return m
        if fa * fm <= 0:
            b, fb = m, fm
        else:
            a, fa = m, fm
    return 0.5 * (a + b)


def pmt(rate: float, nper: int, pv_amt: float, fv_amt: float = 0.0, when: str = "end") -> float:
    """Excel-like PMT for annual periods."""
    if nper <= 0:
        return 0.0
    b = 1.0 if when == "begin" else 0.0
    if rate == 0:
        return -(pv_amt + fv_amt) / nper
    factor = (1.0 + rate) ** nper
    return -(pv_amt * factor + fv_amt) * rate / ((1.0 + rate * (1.0 - b)) * (factor - 1.0))


# =============================================================================
# Debt schedule builders
# =============================================================================

def build_interest_only_then_cpm(
    principal: float, rate: float, io_years: int, amort_years: int
) -> Tuple[List[float], List[float], List[float]]:
    """Fund-level schedule: IO during development, then constant-payment amortisation."""
    total_T = io_years + amort_years
    interest = [0.0] * (total_T + 1)
    principal_pay = [0.0] * (total_T + 1)
    payment = [0.0] * (total_T + 1)

    for t in range(1, io_years + 1):
        interest[t] = rate * principal
        payment[t] = interest[t]

    if amort_years > 0 and principal > 0:
        ann = -pmt(rate, amort_years, pv_amt=principal, fv_amt=0.0, when="end")
        bal = principal
        for k in range(1, amort_years + 1):
            t = io_years + k
            i = rate * bal
            p = max(ann - i, 0.0)
            if p > bal:
                p = bal
            bal -= p
            interest[t] = i
            principal_pay[t] = p
            payment[t] = i + p

        if abs(bal) > 1e-6:
            principal_pay[total_T] += bal
            payment[total_T] += bal

    return interest, principal_pay, payment


def build_dev_debt_io_bullet(principal: float, rate: float, dev_years: int) -> Tuple[List[float], List[float]]:
    """Asset-level development debt: interest-only during dev + bullet at dev end."""
    interest = [0.0] * (dev_years + 1)
    bullet = [0.0] * (dev_years + 1)
    for t in range(1, dev_years + 1):
        interest[t] = rate * principal
    bullet[dev_years] = principal
    return interest, bullet


def build_level_payment_amort(
    principal: float, rate: float, amort_years: int, start_year: int, total_horizon: int
) -> Tuple[List[float], List[float], List[float]]:
    """Generic amortizing schedule placed into a horizon array."""
    interest = [0.0] * (total_horizon + 1)
    principal_pay = [0.0] * (total_horizon + 1)
    payment = [0.0] * (total_horizon + 1)

    if principal <= 0 or amort_years <= 0:
        return interest, principal_pay, payment

    ann = -pmt(rate, amort_years, pv_amt=principal, fv_amt=0.0, when="end")
    bal = principal
    for k in range(1, amort_years + 1):
        t = start_year + k - 1
        if t > total_horizon:
            break
        i = rate * bal
        p = max(ann - i, 0.0)
        if p > bal:
            p = bal
        bal -= p
        interest[t] = i
        principal_pay[t] = p
        payment[t] = i + p

    last_t = min(start_year + amort_years - 1, total_horizon)
    if abs(bal) > 1e-6 and last_t >= 0:
        principal_pay[last_t] += bal
        payment[last_t] += bal

    return interest, principal_pay, payment


# =============================================================================
# Metrics
# =============================================================================

def lp_metrics_from_series(cf: List[float]) -> Tuple[float, float]:
    cfs = [CashFlow(t, cf[t]) for t in range(len(cf))]
    r = irr(cfs, guess=0.07, max_rate=5.0)
    neg = -sum(x for x in cf if x < 0)
    pos = sum(x for x in cf if x > 0)
    moic = pos / neg if neg > 0 else float("nan")
    return r, moic


def avg_cash_on_cash(cf: List[float], equity0: float, t_start: int, t_end: int) -> float:
    if equity0 <= 0 or t_end < t_start:
        return float("nan")
    vals = []
    for t in range(t_start, t_end + 1):
        vals.append(max(cf[t], 0.0) / equity0)
    return sum(vals) / len(vals) if vals else float("nan")


def avg_cash_on_cash_excluding_exit(cf: List[float], equity0: float, t_start: int, exit_year: int) -> float:
    return avg_cash_on_cash(cf, equity0, t_start, max(t_start, exit_year - 1))


# =============================================================================
# Fees
# =============================================================================

def apply_management_fees(
    pool_cf: List[float], fee_base: float, annual_fee_rate: float, fee_years: int
) -> Tuple[List[float], List[float]]:
    """Subtract annual management fee from a pool and return (pool_after_fees, fee_cf)."""
    n = len(pool_cf)
    fee_cf = [0.0] * n
    out = pool_cf.copy()

    annual_fee = annual_fee_rate * fee_base
    for t in range(1, min(fee_years, n - 1) + 1):
        out[t] -= annual_fee
        fee_cf[t] += annual_fee
    return out, fee_cf


# =============================================================================
# True waterfall (European-style)
# =============================================================================

def waterfall_true_return_pref_catchup_promote(
    available_cf: List[float],
    lp_contribution0: float,
    hurdle_rate: float,
    gp_promote: float,
    catchup_rate_to_gp: float,
    exit_year: int,
) -> Dict[str, Any]:
    """Cumulative fund-level waterfall:
    Return of capital -> hurdle -> catch-up -> promote split.
    """
    n = len(available_cf)
    T = n - 1
    exit_year = min(max(exit_year, 0), T)

    lp_cf = [0.0] * n
    gp_cf = [0.0] * n
    lp_cf[0] = -lp_contribution0

    unrecovered_capital = lp_contribution0
    accrued_hurdle = 0.0

    gp_profit_received = 0.0
    lp_profit_received = 0.0

    progression = []

    for t in range(1, n):
        if unrecovered_capital > 1e-12:
            accrued_hurdle += unrecovered_capital * hurdle_rate

        cash = available_cf[t]
        if cash <= 0:
            lp_cf[t] += cash
            progression.append(
                {
                    "Year": t,
                    "Cash Available": cash,
                    "Paid Return of Capital": 0.0,
                    "Paid Hurdle": 0.0,
                    "Paid Catch-up to GP": 0.0,
                    "Paid Residual to LP": 0.0,
                    "Paid Residual to GP": 0.0,
                    "Unrecovered Capital (end)": unrecovered_capital,
                    "Accrued Hurdle (end)": accrued_hurdle,
                }
            )
            continue

        cash_start = cash
        roc_paid = 0.0
        hurdle_paid = 0.0
        catchup_paid_gp = 0.0
        residual_lp = 0.0
        residual_gp = 0.0

        # 1) Return of capital
        if unrecovered_capital > 0:
            pay = min(cash, unrecovered_capital)
            roc_paid = pay
            lp_cf[t] += pay
            cash -= pay
            unrecovered_capital -= pay

        # 2) Hurdle
        if cash > 0 and accrued_hurdle > 0:
            pay = min(cash, accrued_hurdle)
            hurdle_paid = pay
            lp_cf[t] += pay
            cash -= pay
            accrued_hurdle -= pay
            lp_profit_received += pay

        # 3) Catch-up to GP (simple target-based)
        if cash > 0 and gp_promote > 0:
            total_profit_so_far = lp_profit_received + gp_profit_received
            gp_target = gp_promote * total_profit_so_far / max(1e-12, (1.0 - gp_promote))
            gp_needed = max(gp_target - gp_profit_received, 0.0)

            if gp_needed > 1e-12:
                effective_to_gp = max(min(catchup_rate_to_gp, 1.0), 0.0)
                cash_required = gp_needed / max(effective_to_gp, 1e-12)
                take = min(cash, cash_required)
                gp_take = take * effective_to_gp
                lp_take = take - gp_take

                catchup_paid_gp = gp_take
                gp_cf[t] += gp_take
                lp_cf[t] += lp_take
                gp_profit_received += gp_take
                lp_profit_received += lp_take
                cash -= take

        # 4) Residual split
        if cash > 0:
            residual_gp = cash * gp_promote
            residual_lp = cash - residual_gp
            gp_cf[t] += residual_gp
            lp_cf[t] += residual_lp
            gp_profit_received += residual_gp
            lp_profit_received += residual_lp
            cash = 0.0

        progression.append(
            {
                "Year": t,
                "Cash Available": cash_start,
                "Paid Return of Capital": roc_paid,
                "Paid Hurdle": hurdle_paid,
                "Paid Catch-up to GP": catchup_paid_gp,
                "Paid Residual to LP": residual_lp,
                "Paid Residual to GP": residual_gp,
                "Unrecovered Capital (end)": unrecovered_capital,
                "Accrued Hurdle (end)": accrued_hurdle,
            }
        )

    return {"lp_cf": lp_cf, "gp_cf": gp_cf, "progression": progression}


# =============================================================================
# First-loss allocator for common tranches
# =============================================================================

def allocate_common_to_tranches_with_first_loss(
    common_net_cf: List[float],
    private_equity0: float,
    eif_equity0: float,
    junior_equity0: float,
) -> Dict[str, List[float]]:
    """Allocate common net CF to Private/EIF/Junior with cumulative first-loss junior."""
    n = len(common_net_cf)
    priv = [0.0] * n
    eif = [0.0] * n
    jun = [0.0] * n

    priv[0] = -private_equity0
    eif[0] = -eif_equity0
    jun[0] = -junior_equity0

    total0 = private_equity0 + eif_equity0 + junior_equity0
    w_priv = private_equity0 / total0 if total0 > 0 else 0.0
    w_eif = eif_equity0 / total0 if total0 > 0 else 0.0
    w_jun = junior_equity0 / total0 if total0 > 0 else 0.0

    junior_remaining = junior_equity0

    for t in range(1, n):
        x = common_net_cf[t]
        if x >= 0:
            priv[t] += x * w_priv
            eif[t] += x * w_eif
            jun[t] += x * w_jun
        else:
            loss = x  # negative
            junior_absorb = 0.0
            if junior_remaining > 0:
                junior_absorb = max(loss, -junior_remaining)  # negative number
                junior_remaining += junior_absorb
            jun[t] += junior_absorb
            rem = loss - junior_absorb  # still negative

            denom = w_priv + w_eif
            if abs(denom) > 1e-12:
                priv[t] += rem * (w_priv / denom)
                eif[t] += rem * (w_eif / denom)

    return {"private_cf": priv, "eif_cf": eif, "junior_cf": jun}


# =============================================================================
# Helpers: equity/leverage/exit
# =============================================================================

def _compute_junior_equity(base_equity_without_junior: float, junior_pct_of_total_equity: float) -> float:
    if junior_pct_of_total_equity <= 0 or base_equity_without_junior <= 0:
        return 0.0
    if junior_pct_of_total_equity >= 0.999:
        return float("inf")
    return (junior_pct_of_total_equity / (1.0 - junior_pct_of_total_equity)) * base_equity_without_junior


def _fund_debt_from_leverage(fund_equity: float, leverage: float) -> float:
    if leverage <= 0:
        return 0.0
    if leverage >= 0.999:
        return float("inf")
    return fund_equity * (leverage / (1.0 - leverage))


def _weighted_avg(df: pd.DataFrame, col: str) -> float:
    return float((df["Weight (norm)"] * df[col]).sum())


def _exit_value_two_stage_affordable_then_market(
    noi_exit_affordable: float,
    aff_years_remaining: int,
    growth_rate: float,
    discount_rate: float,
    market_cap_after_affordability: float,
    market_rent_uplift_after_affordability: float,
) -> Dict[str, float]:
    pv_aff_stream = 0.0
    for k in range(1, aff_years_remaining + 1):
        noi_k = noi_exit_affordable * ((1.0 + growth_rate) ** (k - 1))
        pv_aff_stream += noi_k / ((1.0 + discount_rate) ** k)

    noi_end_aff = noi_exit_affordable * ((1.0 + growth_rate) ** max(aff_years_remaining - 1, 0))
    noi_market = noi_end_aff * max(market_rent_uplift_after_affordability, 1.0)

    terminal_value = noi_market / market_cap_after_affordability if market_cap_after_affordability > 0 else 0.0
    pv_terminal = terminal_value / ((1.0 + discount_rate) ** max(aff_years_remaining, 1))

    return {
        "PV Affordable NOI Stream": pv_aff_stream,
        "PV Terminal Value (market after affordability)": pv_terminal,
        "Exit Value (two-stage)": pv_aff_stream + pv_terminal,
    }


# =============================================================================
# Core engine builder (asset-side -> distributable)
# =============================================================================

def _run_core_engine(
    private_equity_total: float,
    eif_equity: float,
    junior_equity_pct: float,
    pref_amount: float,
    fund_leverage: float,
    eib_rate: float,
    dev_years: int,
    hold_years: int,
    # optional dev debt
    use_asset_dev_debt: bool,
    asset_ltc_dev: float,
    asset_dev_debt_rate: float,
    # optional stabilized mortgage
    use_asset_mortgage: bool,
    asset_ltv_stabilized: float,
    asset_mortgage_rate: float,
    asset_mortgage_amort_years: int,
    # rotation
    impact_exit_pct_of_private: float,
    rotation_mode: str,
    buyout_debt_rate: float,
    impact_buyout_pricing: str,
    # exit valuation
    reversion_mode: str,
    valuation_method: str,
    market_exit_cap: float,
    market_rent_uplift: float,
    # affordability convention: years FROM STABILISATION
    affordable_years_total: int,
    valuation_discount_rate: float,
    market_cap_after_affordability: float,
    market_uplift_after_affordability: float,
    country_df: pd.DataFrame,
) -> Dict[str, Any]:
    total_horizon = dev_years + hold_years

    base_common_equity = private_equity_total + eif_equity
    junior_equity = _compute_junior_equity(base_common_equity, junior_equity_pct)
    common_equity0 = base_common_equity + junior_equity

    total_equity0 = common_equity0 + max(pref_amount, 0.0)
    fund_debt0 = _fund_debt_from_leverage(total_equity0, fund_leverage)
    total_fund_capital0 = total_equity0 + fund_debt0

    if use_asset_dev_debt and asset_ltc_dev >= 0.999:
        raise ValueError("asset_ltc_dev must be < 1.0")

    total_dev_cost = total_fund_capital0 if not use_asset_dev_debt else total_fund_capital0 / (1.0 - asset_ltc_dev)
    total_asset_dev_debt = 0.0 if not use_asset_dev_debt else total_dev_cost * asset_ltc_dev

    # Build stabilisation table
    rows = []
    total_value_stab = 0.0
    total_noi_stab = 0.0

    for _, r in country_df.iterrows():
        w = float(r["Weight (norm)"])
        dev_irr = float(r["Unlevered Dev IRR (annual)"])
        aff_y = float(r["Stabilized Affordable Yield (NOI/Value)"])
        infl = float(r["Inflation (CPI)"])

        cost_i = total_dev_cost * w
        dev_debt_i = (cost_i * asset_ltc_dev) if use_asset_dev_debt else 0.0
        equity_like_i = cost_i - dev_debt_i

        equity_value_stab_i = equity_like_i * ((1.0 + dev_irr) ** dev_years)
        value_stab_i = equity_value_stab_i + dev_debt_i
        noi_stab_i = value_stab_i * aff_y

        rows.append(
            {
                "Country": r["Country"],
                "Weight (norm)": w,
                "Dev Cost [€]": cost_i,
                "Asset Dev Debt [€]": dev_debt_i,
                "Equity-like Capital [€]": equity_like_i,
                "Stabilized Equity Value [€]": equity_value_stab_i,
                "Stabilized Asset Value [€]": value_stab_i,
                "Stabilized NOI [€]": noi_stab_i,
                "Dev IRR (unlevered)": dev_irr,
                "Affordable Yield": aff_y,
                "Inflation": infl,
            }
        )

        total_value_stab += value_stab_i
        total_noi_stab += noi_stab_i

    stab_df = pd.DataFrame(rows)

    # EIB debt schedule: IO during dev then amort over hold
    eib_int, eib_prin, eib_pay = build_interest_only_then_cpm(
        principal=fund_debt0, rate=eib_rate, io_years=dev_years, amort_years=hold_years
    )
    if len(eib_pay) < total_horizon + 1:
        pad = total_horizon + 1 - len(eib_pay)
        eib_int += [0.0] * pad
        eib_prin += [0.0] * pad
        eib_pay += [0.0] * pad
    else:
        eib_int = eib_int[: total_horizon + 1]
        eib_prin = eib_prin[: total_horizon + 1]
        eib_pay = eib_pay[: total_horizon + 1]

    # Rotation / buyout amount (as % of private equity)
    impact_base = private_equity_total * max(impact_exit_pct_of_private, 0.0)
    wavg_dev_irr = _weighted_avg(country_df, "Unlevered Dev IRR (annual)")
    if str(impact_buyout_pricing).lower().startswith("stabil"):
        price_multiple = (1.0 + wavg_dev_irr) ** dev_years
    else:
        price_multiple = 1.0
    impact_exit_amount = impact_base * price_multiple

    buyout_debt0 = (
        impact_exit_amount
        if (str(rotation_mode).lower().startswith("borrow") and impact_exit_amount > 0)
        else 0.0
    )
    _, _, buyout_pay = build_level_payment_amort(
        principal=buyout_debt0,
        rate=buyout_debt_rate,
        amort_years=hold_years,
        start_year=dev_years + 1,
        total_horizon=total_horizon,
    )

    # Optional asset dev debt
    asset_dev_interest = [0.0] * (total_horizon + 1)
    asset_dev_bullet = [0.0] * (total_horizon + 1)
    if use_asset_dev_debt and total_asset_dev_debt > 0:
        i_arr, b_arr = build_dev_debt_io_bullet(total_asset_dev_debt, asset_dev_debt_rate, dev_years)
        for t in range(0, dev_years + 1):
            asset_dev_interest[t] = i_arr[t]
            asset_dev_bullet[t] = b_arr[t]

    # Optional stabilized mortgage (payments only needed for CF)
    asset_mortgage0 = 0.0
    asset_mort_pay = [0.0] * (total_horizon + 1)
    if use_asset_mortgage and asset_ltv_stabilized > 0:
        asset_mortgage0 = total_value_stab * asset_ltv_stabilized
        _, _, asset_mort_pay = build_level_payment_amort(
            principal=asset_mortgage0,
            rate=asset_mortgage_rate,
            amort_years=max(asset_mortgage_amort_years, 1),
            start_year=dev_years + 1,
            total_horizon=total_horizon,
        )

    # NOI grows by weighted inflation from stabilisation year onwards
    wavg_infl = _weighted_avg(country_df, "Inflation (CPI)")
    noi = [0.0] * (total_horizon + 1)
    for t in range(dev_years + 1, total_horizon + 1):
        yrs = t - (dev_years + 1)
        noi[t] = total_noi_stab * ((1.0 + wavg_infl) ** yrs)

    # Exit / reversion
    reversion = [0.0] * (total_horizon + 1)
    exit_components: Dict[str, float] = {}

    if str(reversion_mode).lower().startswith("market"):
        noi_exit_aff = noi[total_horizon]

        if str(valuation_method).lower().startswith("two"):
            # affordability measured from stabilisation; exit occurs after hold_years
            years_elapsed_since_stab = hold_years
            aff_remaining = max(affordable_years_total - years_elapsed_since_stab, 0)

            comp = _exit_value_two_stage_affordable_then_market(
                noi_exit_affordable=noi_exit_aff,
                aff_years_remaining=aff_remaining,
                growth_rate=wavg_infl,
                discount_rate=max(valuation_discount_rate, 1e-6),
                market_cap_after_affordability=max(market_cap_after_affordability, 1e-6),
                market_rent_uplift_after_affordability=max(market_uplift_after_affordability, 1.0),
            )
            value_exit = comp["Exit Value (two-stage)"]
            exit_components = {
                "Exit NOI (affordable, Year T)": float(noi_exit_aff),
                "Affordable years remaining at exit (from stabilisation)": float(aff_remaining),
                "PV Affordable NOI Stream": float(comp["PV Affordable NOI Stream"]),
                "PV Terminal Value (market after affordability)": float(comp["PV Terminal Value (market after affordability)"]),
                "Exit Value": float(value_exit),
            }
        else:
            noi_exit_market = noi_exit_aff * max(market_rent_uplift, 1.0)
            value_exit = noi_exit_market / market_exit_cap if market_exit_cap > 0 else 0.0
            exit_components = {
                "Exit NOI (affordable, Year T)": float(noi_exit_aff),
                "Market uplift applied at exit": float(max(market_rent_uplift, 1.0)),
                "Exit NOI used for cap": float(noi_exit_market),
                "Exit cap rate": float(market_exit_cap),
                "Exit Value": float(value_exit),
            }

        reversion[total_horizon] = value_exit

    # Portfolio CF (asset-side)
    portfolio_cf = [0.0] * (total_horizon + 1)
    for t in range(1, total_horizon + 1):
        portfolio_cf[t] += noi[t]
        portfolio_cf[t] -= asset_mort_pay[t]
        portfolio_cf[t] -= asset_dev_interest[t]
        portfolio_cf[t] -= asset_dev_bullet[t]
    portfolio_cf[total_horizon] += reversion[total_horizon]

    # Rotation cashflows (debt proceeds in; buyout payment out) net to ~0 at dev end
    rotation_cash_in = impact_exit_amount if buyout_debt0 > 0 else 0.0
    rotation_cash_out = impact_exit_amount if buyout_debt0 > 0 else 0.0
    portfolio_cf[dev_years] += rotation_cash_in

    distributable_to_equity = [0.0] * (total_horizon + 1)
    for t in range(1, total_horizon + 1):
        distributable_to_equity[t] = portfolio_cf[t] - eib_pay[t] - buyout_pay[t]
    distributable_to_equity[dev_years] -= rotation_cash_out

    # DSCRs (operating years only): DSCR = NOI / payment
    dscr_eib = [None] * (total_horizon + 1)
    dscr_buyout = [None] * (total_horizon + 1)
    dscr_total_fund = [None] * (total_horizon + 1)

    for t in range(1, total_horizon + 1):
        if t <= dev_years:
            continue
        if eib_pay[t] > 0:
            dscr_eib[t] = noi[t] / eib_pay[t]
        if buyout_pay[t] > 0:
            dscr_buyout[t] = noi[t] / buyout_pay[t]
        total_pay = eib_pay[t] + buyout_pay[t]
        if total_pay > 0:
            dscr_total_fund[t] = noi[t] / total_pay

    sched_df = pd.DataFrame(
        {
            "Year": list(range(total_horizon + 1)),
            "NOI [€]": noi,
            "Asset Mortgage Payment [€]": asset_mort_pay,
            "Asset Dev Interest [€]": asset_dev_interest,
            "Asset Dev Bullet [€]": asset_dev_bullet,
            "Reversion [€]": reversion,
            "Portfolio CF [€]": portfolio_cf,
            "EIB Payment [€]": eib_pay,
            "Buyout Payment [€]": buyout_pay,
            "Distributable to Equity [€]": distributable_to_equity,
            "DSCR (EIB)": dscr_eib,
            "DSCR (Buyout)": dscr_buyout,
            "DSCR (Total Fund Debt)": dscr_total_fund,
        }
    )

    return {
        "total_horizon": total_horizon,
        "common_equity0": common_equity0,
        "total_equity0": total_equity0,
        "junior_equity0": junior_equity,
        "private_equity0": private_equity_total,
        "eif_equity0": eif_equity,
        "pref_equity0": max(pref_amount, 0.0),
        "fund_debt0": fund_debt0,
        "total_fund_capital0": total_fund_capital0,
        "total_dev_cost": total_dev_cost,
        "total_asset_dev_debt": total_asset_dev_debt,
        "asset_mortgage0": asset_mortgage0,
        "total_value_stab": total_value_stab,
        "total_noi_stab": total_noi_stab,
        "wavg_infl": wavg_infl,
        "wavg_dev_irr": wavg_dev_irr,
        "impact_exit_amount": impact_exit_amount,
        "buyout_debt0": buyout_debt0,
        "impact_exit_pct_of_private": impact_exit_pct_of_private,
        # IMPORTANT: keep scalars numeric. Put strings into a Meta table outside.
        "market_exit_cap": float(market_exit_cap),
        "affordable_years_total": int(affordable_years_total),
        "stab_df": stab_df,
        "sched_df": sched_df,
        "distributable_to_equity": distributable_to_equity,
        "exit_value_components": exit_components,
    }


# =============================================================================
# Main runner
# =============================================================================

def run(inputs: Dict[str, Any]) -> Dict[str, Any]:
    warnings: List[WarningMsg] = []

    fund = inputs.get("fund", {}) or {}
    rates = inputs.get("rates", {}) or {}
    cap_programs = inputs.get("capital_programs", {}) or {}
    strategies = inputs.get("strategies", {}) or {}
    fees = inputs.get("fees", {}) or {}
    pref_in = inputs.get("preferred_equity", {}) or {}
    wf = inputs.get("waterfall", {}) or {}

    # Horizon
    dev_years = int(as_float(fund.get("dev_years", 3), 3))
    hold_years = int(as_float(fund.get("hold_years", 20), 20))
    total_horizon = dev_years + hold_years
    exit_year = total_horizon

    # Equity inputs
    private_equity_total = as_float(fund.get("private_equity_total", 500_000_000.0), 500_000_000.0)
    eif_equity = as_float(fund.get("eif_equity", 200_000_000.0), 200_000_000.0)
    junior_pct = as_pct(fund.get("junior_equity_pct_of_total_equity", 0.0), 0.0)

    # Preferred (optional)
    preferred_enabled = bool(pref_in.get("enabled", False))
    preferred_amount = as_float(pref_in.get("preferred_amount", 0.0), 0.0) if preferred_enabled else 0.0
    preferred_rate = as_float(pref_in.get("preferred_rate", 0.08), 0.08)

    # Fund leverage (D / (D+E)) — accept 0.5 or 50
    fund_leverage = as_pct(cap_programs.get("eib_share_of_total_fund_capital", 0.50), 0.50)
    eib_rate = as_float(rates.get("eib_rate", 0.02), 0.02)

    # Asset-level dev debt
    use_asset_dev_debt = bool(fund.get("use_asset_dev_debt", False))
    asset_ltc = as_pct(fund.get("asset_ltc", 0.0), 0.0)
    asset_dev_debt_rate = as_float(rates.get("asset_dev_debt_rate", fund.get("asset_dev_debt_rate", 0.05)), 0.05)

    # Asset mortgage (default off)
    use_asset_mortgage = bool(fund.get("use_asset_mortgage", False))
    asset_ltv_stabilized = as_pct(fund.get("asset_ltv_stabilized", 0.0), 0.0)
    asset_mortgage_rate = as_float(fund.get("asset_mortgage_rate", 0.045), 0.045)
    asset_mortgage_amort_years = int(as_float(fund.get("asset_mortgage_amort_years", 20), 20))

    # Rotation / impact exit
    rotation_enabled = bool(strategies.get("rotation_enabled", False))
    impact_exit_pct = as_pct(strategies.get("impact_exit_pct_of_private", 0.0), 0.0) if rotation_enabled else 0.0
    rotation_mode = str(strategies.get("rotation_mode", "Borrow buyout debt (CPM to exit)"))
    buyout_debt_rate = as_float(rates.get("buyout_debt_rate", 0.0175), 0.0175)
    impact_buyout_pricing = str(strategies.get("impact_buyout_pricing", "Stabilized (remove dev return)"))

    # Exit valuation
    reversion_mode = str(strategies.get("reversion_mode", "Market sale at fund exit"))
    valuation_method = str(fund.get("valuation_method", "Simple cap-rate (cap already reflects affordability)"))
    market_exit_cap = as_float(fund.get("market_exit_cap_rate", 0.05), 0.05)
    market_rent_uplift = as_float(fund.get("market_rent_uplift_at_exit", 1.0), 1.0)

    # Years from stabilisation
    affordable_years_total = int(as_float(fund.get("affordable_years_total", hold_years), hold_years))
    valuation_discount_rate = as_float(fund.get("valuation_discount_rate", 0.06), 0.06)
    market_cap_after_affordability = as_float(fund.get("market_cap_after_affordability", 0.05), 0.05)
    market_uplift_after_affordability = as_float(fund.get("market_uplift_after_affordability", 1.25), 1.25)

    # Country mix
    cmix = inputs.get("country_mix", []) or []
    if not isinstance(cmix, list) or len(cmix) == 0:
        warnings.append(
            WarningMsg(
                code="COUNTRY_MIX_EMPTY",
                message="country_mix is empty; using a 1-row default.",
                severity="warning",
                context={},
            )
        )
        cmix = [{"country": "Spain", "weight": 1.0, "dev_irr": 0.10, "aff_yield": 0.045, "inflation": 0.02}]

    w_sum = sum(as_float(r.get("weight", 0.0), 0.0) for r in cmix)
    if w_sum <= 0:
        warnings.append(
            WarningMsg(
                code="COUNTRY_MIX_WEIGHTS_ZERO",
                message="All country weights are zero; using equal weights.",
                severity="warning",
                context={},
            )
        )
        w_sum = float(len(cmix))
        for r in cmix:
            r["weight"] = 1.0

    rows = []
    for r in cmix:
        country = str(r.get("country", "Unknown"))
        w = as_float(r.get("weight", 0.0), 0.0) / w_sum
        dev_irr = as_float(r.get("dev_irr", 0.10), 0.10)
        aff_yield = as_float(r.get("aff_yield", 0.045), 0.045)
        infl = as_float(r.get("inflation", 0.02), 0.02)
        rows.append(
            {
                "Country": country,
                "Weight (norm)": w,
                "Unlevered Dev IRR (annual)": dev_irr,
                "Stabilized Affordable Yield (NOI/Value)": aff_yield,
                "Inflation (CPI)": infl,
            }
        )
    country_df = pd.DataFrame(rows)

    # Core engine
    core = _run_core_engine(
        private_equity_total=private_equity_total,
        eif_equity=eif_equity,
        junior_equity_pct=junior_pct,
        pref_amount=preferred_amount,
        fund_leverage=fund_leverage,
        eib_rate=eib_rate,
        dev_years=dev_years,
        hold_years=hold_years,
        use_asset_dev_debt=use_asset_dev_debt,
        asset_ltc_dev=asset_ltc,
        asset_dev_debt_rate=asset_dev_debt_rate,
        use_asset_mortgage=use_asset_mortgage,
        asset_ltv_stabilized=asset_ltv_stabilized,
        asset_mortgage_rate=asset_mortgage_rate,
        asset_mortgage_amort_years=asset_mortgage_amort_years,
        impact_exit_pct_of_private=impact_exit_pct,
        rotation_mode=rotation_mode,
        buyout_debt_rate=buyout_debt_rate,
        impact_buyout_pricing=impact_buyout_pricing,
        reversion_mode=reversion_mode,
        valuation_method=valuation_method,
        market_exit_cap=market_exit_cap,
        market_rent_uplift=market_rent_uplift,
        affordable_years_total=affordable_years_total,
        valuation_discount_rate=valuation_discount_rate,
        market_cap_after_affordability=market_cap_after_affordability,
        market_uplift_after_affordability=market_uplift_after_affordability,
        country_df=country_df,
    )

    common_equity0 = float(core["common_equity0"])
    private0 = float(core["private_equity0"])
    eif0 = float(core["eif_equity0"])
    junior0 = float(core["junior_equity0"])
    fund_debt0 = float(core["fund_debt0"])
    deployable = float(core["total_fund_capital0"])
    total_noi_stab = float(core["total_noi_stab"])
    wavg_infl = float(core["wavg_infl"])

    # Gross common CF (after fund debt, before fees/waterfall): Year0 = -E, then distributable series
    dist_to_eq = list(core["distributable_to_equity"])
    common_gross_cf = [0.0] * (total_horizon + 1)
    common_gross_cf[0] = -common_equity0
    for t in range(1, total_horizon + 1):
        common_gross_cf[t] = dist_to_eq[t]

    irr_gross_A, moic_gross_A = lp_metrics_from_series(common_gross_cf)
    t_op_start = dev_years + 1
    avg_coc_gross_A = avg_cash_on_cash_excluding_exit(common_gross_cf, common_equity0, t_op_start, exit_year)
    coc_year1_gross_A = (
        (max(common_gross_cf[t_op_start], 0.0) / common_equity0)
        if (common_equity0 > 0 and t_op_start <= exit_year)
        else float("nan")
    )

    # Fees: annual fee on common equity
    founder_fee_rate = as_float(fees.get("founder_mgmt_fee_rate", 0.02), 0.02)
    bank_fee_rate = as_float(fees.get("bank_fee_rate", 0.005), 0.005)
    token_fee_rate = as_float(fees.get("token_fee_rate", 0.005), 0.005)
    annual_fee_rate_total = max(founder_fee_rate + bank_fee_rate + token_fee_rate, 0.0)

    pool_after_fees_A, fee_cf_A = apply_management_fees(
        pool_cf=common_gross_cf,
        fee_base=common_equity0,
        annual_fee_rate=annual_fee_rate_total,
        fee_years=total_horizon,
    )

    # True waterfall on remaining pool (carry/promote)
    hurdle_rate = as_float(wf.get("hurdle_rate", 0.08), 0.08)
    promote_rate = as_float(fees.get("promote_rate", 0.20), 0.20)
    catchup_rate_to_gp = as_float(wf.get("catchup_rate_to_gp", 1.0), 1.0)

    wfA = waterfall_true_return_pref_catchup_promote(
        available_cf=pool_after_fees_A,
        lp_contribution0=common_equity0,
        hurdle_rate=hurdle_rate,
        gp_promote=promote_rate,
        catchup_rate_to_gp=catchup_rate_to_gp,
        exit_year=exit_year,
    )

    # Founder = fees + promote cashflows (GP side)
    founder_cf_A = [fee_cf_A[t] + wfA["gp_cf"][t] for t in range(total_horizon + 1)]
    common_net_cf_A = wfA["lp_cf"]

    irr_common_net_A, moic_common_net_A = lp_metrics_from_series(common_net_cf_A)
    avg_coc_net_A = avg_cash_on_cash_excluding_exit(common_net_cf_A, common_equity0, t_op_start, exit_year)

    # Allocate net common CF to tranches with first loss
    allocA = allocate_common_to_tranches_with_first_loss(
        common_net_cf=common_net_cf_A,
        private_equity0=private0,
        eif_equity0=eif0,
        junior_equity0=junior0,
    )

    wfA_summary = pd.DataFrame(
        [
            {"Metric": "Hurdle rate", "Value": hurdle_rate},
            {"Metric": "Promote rate", "Value": promote_rate},
            {"Metric": "Catch-up rate to GP", "Value": catchup_rate_to_gp},
            {"Metric": "Annual fee rate (total)", "Value": annual_fee_rate_total},
            {"Metric": "IRR common net (A)", "Value": irr_common_net_A},
            {"Metric": "MOIC common net (A)", "Value": moic_common_net_A},
            {"Metric": "Avg CoC net excl exit (A)", "Value": avg_coc_net_A},
        ]
    )

    cashflows_A = pd.DataFrame(
        {
            "Year": list(range(total_horizon + 1)),
            "Common Gross CF [€]": common_gross_cf,
            "Common Net CF [€]": common_net_cf_A,
            "Founder CF [€]": founder_cf_A,
            "Private Net CF [€]": allocA["private_cf"],
            "EIF Net CF [€]": allocA["eif_cf"],
            "Junior Net CF [€]": allocA["junior_cf"],
            "CoC Gross": [
                max(common_gross_cf[t], 0.0) / common_equity0 if common_equity0 > 0 else None
                for t in range(total_horizon + 1)
            ],
            "CoC Net": [
                max(common_net_cf_A[t], 0.0) / common_equity0 if common_equity0 > 0 else None
                for t in range(total_horizon + 1)
            ],
        }
    )

    # Waterfall B (Preferred + Common)
    wfB_summary = pd.DataFrame([])
    cashflows_B = pd.DataFrame([])

    if preferred_enabled and preferred_amount > 0:
        pool_after_fees_B = pool_after_fees_A.copy()

        preferred_cf = [0.0] * (total_horizon + 1)
        preferred_cf[0] = -preferred_amount

        # coupon in operating years, principal at exit
        for t in range(1, total_horizon + 1):
            if t <= dev_years:
                continue
            preferred_cf[t] += preferred_amount * preferred_rate
        preferred_cf[exit_year] += preferred_amount

        residual_for_common = [0.0] * (total_horizon + 1)
        residual_for_common[0] = -common_equity0
        for t in range(1, total_horizon + 1):
            residual_for_common[t] = pool_after_fees_B[t] - max(preferred_cf[t], 0.0)

        wfB = waterfall_true_return_pref_catchup_promote(
            available_cf=residual_for_common,
            lp_contribution0=common_equity0,
            hurdle_rate=hurdle_rate,
            gp_promote=promote_rate,
            catchup_rate_to_gp=catchup_rate_to_gp,
            exit_year=exit_year,
        )

        founder_cf_B = [fee_cf_A[t] + wfB["gp_cf"][t] for t in range(total_horizon + 1)]
        common_net_cf_B = wfB["lp_cf"]

        irr_common_net_B, moic_common_net_B = lp_metrics_from_series(common_net_cf_B)
        irr_pref_B, moic_pref_B = lp_metrics_from_series(preferred_cf)

        wfB_summary = pd.DataFrame(
            [
                {"Metric": "Preferred amount", "Value": preferred_amount},
                {"Metric": "Preferred rate", "Value": preferred_rate},
                {"Metric": "IRR preferred (B)", "Value": irr_pref_B},
                {"Metric": "MOIC preferred (B)", "Value": moic_pref_B},
                {"Metric": "IRR common net (B)", "Value": irr_common_net_B},
                {"Metric": "MOIC common net (B)", "Value": moic_common_net_B},
            ]
        )

        cashflows_B = pd.DataFrame(
            {
                "Year": list(range(total_horizon + 1)),
                "Preferred CF [€]": preferred_cf,
                "Common Net CF [€]": common_net_cf_B,
                "Founder CF [€]": founder_cf_B,
            }
        )

    # Exit components table (audit)
    exit_components = core.get("exit_value_components", {}) or {}
    exit_components_table = [{"Metric": k, "Value": v} for k, v in exit_components.items()]

    # Meta table (PUT STRINGS HERE, NOT IN SCALARS)
    meta_table = [
        {"Field": "reversion_mode", "Value": str(reversion_mode)},
        {"Field": "valuation_method", "Value": str(valuation_method)},
    ]

    # -----------------------
    # Export scalars/tables/series
    # -----------------------
    scalars: Dict[str, Any] = {
        "dev_years": dev_years,
        "hold_years": hold_years,
        "total_horizon": total_horizon,
        "common_equity0": common_equity0,
        "eib_fund_debt0": fund_debt0,
        "deployable_capital_E_plus_D": deployable,
        "junior_equity0": junior0,
        "private_equity0": private0,
        "eif_equity0": eif0,
        "preferred_amount": preferred_amount,
        "preferred_rate": preferred_rate,
        "total_noi_stab": total_noi_stab,
        "wavg_infl": wavg_infl,
        "irr_gross_A": irr_gross_A,
        "moic_gross_A": moic_gross_A,
        "avg_coc_gross_A": avg_coc_gross_A,
        "coc_year1_gross_A": coc_year1_gross_A,
        "irr_common_net_A": irr_common_net_A,
        "moic_common_net_A": moic_common_net_A,
        "avg_coc_net_A": avg_coc_net_A,
        # rotation diagnostics
        "rotation_enabled": 1.0 if rotation_enabled else 0.0,
        "impact_exit_pct_of_private": float(impact_exit_pct),
        "impact_exit_amount": float(core.get("impact_exit_amount", 0.0)),
        "buyout_debt0": float(core.get("buyout_debt0", 0.0)),
        "buyout_debt_rate": float(buyout_debt_rate),
        # valuation diagnostics
        "market_exit_cap_rate": float(market_exit_cap),
        "market_rent_uplift_at_exit": float(market_rent_uplift),
        "affordable_years_total_from_stabilisation": float(affordable_years_total),
        "market_cap_after_affordability": float(market_cap_after_affordability),
        "market_uplift_after_affordability": float(market_uplift_after_affordability),
        "valuation_discount_rate": float(valuation_discount_rate),
    }

    tables: Dict[str, Any] = {
        "Meta": meta_table,
        "Country_Input_Normalized": country_df.to_dict(orient="records"),
        "Stabilisation": core["stab_df"].to_dict(orient="records"),
        "Core_Schedules": core["sched_df"].to_dict(orient="records"),
        "Exit_Value_Components": exit_components_table,
        "WaterfallA_Summary": wfA_summary.to_dict(orient="records"),
        "Cashflows_WF_A": cashflows_A.to_dict(orient="records"),
    }

    if preferred_enabled and preferred_amount > 0:
        tables["WaterfallB_Summary"] = wfB_summary.to_dict(orient="records")
        tables["Cashflows_WF_B"] = cashflows_B.to_dict(orient="records")
    else:
        tables["WaterfallB_Summary"] = []
        tables["Cashflows_WF_B"] = []

    series: Dict[str, Any] = {
        "coc_gross_A": [
            max(common_gross_cf[t], 0.0) / common_equity0 if common_equity0 > 0 else None
            for t in range(total_horizon + 1)
        ],
        "coc_net_A": [
            max(common_net_cf_A[t], 0.0) / common_equity0 if common_equity0 > 0 else None
            for t in range(total_horizon + 1)
        ],
    }

    return {
        "warnings": warnings,
        "scalars": scalars,
        "tables": tables,
        "series": series,
    }
