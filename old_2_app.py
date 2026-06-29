# ReFi AI — Modules I–III & Legacy Fund (with Preferred Equity)
# ------------------------------------------------------------
# Run with:
#   streamlit run app.py

import io
import math
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Tuple

import numpy as np
import pandas as pd
import streamlit as st
import graphviz


# ------------------------------------------------------------
# Streamlit page config (must be first Streamlit call)
# ------------------------------------------------------------
st.set_page_config(
    page_title="ReFi AI — Modules I–III & Legacy Fund",
    page_icon="🏗️",
    layout="wide",
)


# ------------------------------------------------------------
# Safe imports for auxiliary modules
# ------------------------------------------------------------
# Module 1
try:
    from module1_property_level_v3 import render_module_1_v3
except ImportError:
    def render_module_1_v3():
        st.warning("Could not import render_module_1_v3 from module1_property_level_v3.py")

# Module 2 (levered returns / DSCR)
try:
    from module2_levered_returns_v2 import render_module_2_v2
except ImportError:
    def render_module_2_v2():
        st.warning("Could not import render_module_2_v2 from module2_levered_returns_v2.py")

# Module 3 (mortgage lab)
try:
    from module3_mortgage_lab_v2 import render_module_3_v2
except ImportError:
    def render_module_3_v2():
        st.warning("Could not import render_module_3_v2 from module3_mortgage_lab_v2.py")

# Barcelona explorer
try:
    from module_barcelona import render_module_barcelona
except ImportError:
    def render_module_barcelona():
        st.warning("Could not import render_module_barcelona from module_barcelona.py")

# PS6 / Barcelona single-module version
try:
    from module4_single_v5 import render_module_iii
except ImportError:
    def render_module_iii():
        st.warning("Could not import render_module_iii from module4_single_v5.py")

# AI teacher chat (global)
try:
    from ai_teacher_chat import render_ai_teacher_chat
except ImportError:
    def render_ai_teacher_chat():
        st.info("AI teacher module (ai_teacher_chat.py) not available in this environment.")


# ------------------------------------------------------------
# Utility structures & functions
# ------------------------------------------------------------
@dataclass
class CashFlow:
    t: int
    amount: float


def npv_continuous(cashflows: List[CashFlow], rate: float) -> float:
    return sum(cf.amount * math.exp(-rate * cf.t) for cf in cashflows)


def irr(cashflows: List[CashFlow], guess: float = 0.1, max_rate: float = 2.0) -> float:
    """
    Robust IRR with Newton + bracketing, on a list of CashFlow(t, amount).
    """
    def npv_at(r: float) -> float:
        total = 0.0
        for cf in cashflows:
            expo = -cf.t * math.log1p(r) if r > -0.999999 else 0.0
            term = cf.amount * math.exp(expo)
            total += term
        return total

    # Newton
    r = min(max(guess, -0.9999 + 1e-9), max_rate - 1e-9)
    for _ in range(60):
        f = npv_at(r)
        h = 1e-6
        f1 = npv_at(min(r + h, max_rate - 1e-9))
        df = (f1 - f) / h
        if not math.isfinite(df) or abs(df) < 1e-12:
            break
        new_r = r - f / df
        if not (-0.9999 < new_r < max_rate) or not math.isfinite(new_r):
            break
        if abs(new_r - r) < 1e-7:
            r = new_r
            break
        r = new_r

    # Fallback bracketing if needed
    if not math.isfinite(r) or npv_at(r) * npv_at(0.0) > 0:
        low, high = -0.9999 + 1e-9, max_rate - 1e-9
        f_low, f_high = npv_at(low), npv_at(high)
        if f_low * f_high > 0:
            return r
        for _ in range(100):
            mid = 0.5 * (low + high)
            f_mid = npv_at(mid)
            if abs(f_mid) < 1e-7:
                return mid
            if f_low * f_mid < 0:
                high, f_high = mid, f_mid
            else:
                low, f_low = mid, f_mid
        return 0.5 * (low + high)

    return r


def pmt(rate: float, nper: float, pv_amt: float, fv_amt: float = 0.0, when: str = "end") -> float:
    """
    Excel-style PMT function.
    """
    b = 1 if when == "end" else 0
    if nper == 0:
        return 0.0
    if rate == 0:
        return -(pv_amt + fv_amt) / nper
    factor = (1 + rate) ** nper
    return -(pv_amt * factor + fv_amt) * rate / ((1 + rate * (1 - b)) * (factor - 1))


def export_results_to_excel(template_bytes: Optional[bytes],
                            dfs: Dict[str, pd.DataFrame],
                            scalars: Dict[str, Any],
                            filename: str) -> None:
    """
    Generic Excel export helper.
    Tries xlsxwriter first; if not available, falls back to openpyxl.
    If neither is installed, shows an error message.
    """
    if template_bytes is not None:
        output = io.BytesIO(template_bytes)
    else:
        output = io.BytesIO()

    writer = None
    try:
        writer = pd.ExcelWriter(output, engine="xlsxwriter", mode="w")
    except ImportError:
        try:
            writer = pd.ExcelWriter(output, engine="openpyxl", mode="w")
        except ImportError:
            st.error(
                "To export to Excel, please install either 'xlsxwriter' or 'openpyxl'.\n\n"
                "For example:\n"
                "  - pip install XlsxWriter\n"
                "  - or: conda install -c conda-forge xlsxwriter"
            )
            return

    with writer:
        for sheet_name, df in dfs.items():
            df.to_excel(writer, sheet_name=sheet_name, index=False)
        if scalars:
            scalar_df = pd.DataFrame(
                [{"Metric": k, "Value": v} for k, v in scalars.items()]
            )
            scalar_df.to_excel(writer, sheet_name="Scalars", index=False)

    output.seek(0)
    st.download_button(
        label=f"Download {filename}",
        data=output,
        file_name=filename,
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


# ------------------------------------------------------------
# LEGACY FUND MODULE (with Waterfall A & B)
# ------------------------------------------------------------
def render_legacy_fund_module():
    st.title("Legacy Fund — European Affordable Housing")

    st.caption(
        "Compare an exit at Year 3 (Strategy A) with long-term legacy strategies (Strategy B) "
        "for a European Affordable Housing portfolio. "
        "IRRs and MOICs are nominal and computed at the LP level (after EIB)."
    )

    # -----------------------------
    # Step 1 – Fund Capital & Horizon
    # -----------------------------
    st.subheader("Step 1 – Fund Capital Structure & Horizon")

    col1, col2, col3 = st.columns(3)
    with col1:
        lp_equity_commitment = st.number_input(
            "LP Development Equity (Common) [€]",
            min_value=0.0,
            max_value=2_000_000_000.0,
            value=500_000_000.0,
            step=25_000_000.0,
            format="%.0f",
            help="Original LP equity (this becomes Common Equity when Preferred Equity is added).",
        )
    with col2:
        dev_years = st.number_input(
            "Development Period (years)",
            min_value=1,
            max_value=10,
            value=3,
            step=1,
        )
        hold_years = st.number_input(
            "Legacy Holding Period after Year 3 (years)",
            min_value=10,
            max_value=80,
            value=50,
            step=5,
        )
    with col3:
        eib_rate = st.number_input(
            "EIB Loan Interest Rate (fund level, p.a.)",
            min_value=0.0,
            max_value=0.10,
            value=0.02,
            step=0.0025,
            format="%.4f",
            help="Years 1–3: interest-only; afterwards: amortising.",
        )

    col4, col5, col6 = st.columns(3)
    with col4:
        ltc = st.slider(
            "Property Loan-to-Cost (LTC)",
            min_value=0.0,
            max_value=0.80,
            value=0.60,
            step=0.05,
            help="Development loan at property level as % of total development cost.",
        )
    with col5:
        dev_loan_rate = st.number_input(
            "Development Loan Rate (3-year IO, property level)",
            min_value=0.0,
            max_value=0.20,
            value=0.05,
            step=0.0025,
            format="%.4f",
        )
    with col6:
        prop_loan_rate = st.number_input(
            "53-year Property Loan Rate (base, property level)",
            min_value=0.0,
            max_value=0.10,
            value=0.045,
            step=0.0025,
            format="%.4f",
            help="Used for the 53-year CPM after Year 3.",
        )

    # Alternative property loan rate (spread)
    col7, _ = st.columns([1, 2])
    with col7:
        consider_alt_prop_rate = st.checkbox(
            "Show alternative property loan at (base + 250 bps)?",
            value=True,
        )

    alt_prop_rate = None
    if consider_alt_prop_rate:
        alt_prop_rate = prop_loan_rate + 0.025

    if lp_equity_commitment <= 0:
        st.error("LP development equity must be positive.")
        return

    total_horizon = int(dev_years + hold_years)

    lp_initial = lp_equity_commitment
    eib_principal0 = lp_equity_commitment
    fund_equity_commitment = lp_initial + eib_principal0

    st.info(
        f"**Fund capital at t=0**  \n"
        f"- Common Equity (LPs): **€{lp_initial:,.0f}**  \n"
        f"- EIB loan: **€{eib_principal0:,.0f}**  \n"
        f"- Total fund development equity invested into projects: **€{fund_equity_commitment:,.0f}**  \n"
        f"- Property-level development debt: **LTC = {ltc*100:.0f}%**, interest-only at **{dev_loan_rate*100:.2f}%**."
    )

    # -----------------------------
    # Step 2 – Country mix & dev IRRs (Affordable housing scenarios)
    # -----------------------------
    st.subheader("Step 2 – Country Mix & Levered Development IRRs (Affordable Housing)")

    st.markdown(
        """
We now specify **country allocations and development assumptions** under the constraint that
**rents cannot exceed ~30% of average household income in each city**.

Use the scenario selector to load **Optimistic, Realistic (base)**, or **Pessimistic** assumptions
for:

- Levered development IRR (60% LTC) for affordable housing
- Exit cap rate (Year 3 & 53) for stabilized affordable stock
- CPI inflation (for information; not directly in the cashflow engine)

You can still **edit any numbers** in the table after selecting a scenario.
        """
    )

    scenario_label = st.radio(
        "Select macro / affordability scenario for Step 2",
        ["Realistic (base, affordable)", "Optimistic (affordable)", "Pessimistic (affordable)"],
        horizontal=True,
    )

    if "Optimistic" in scenario_label:
        scenario_name = "optimistic"
    elif "Pessimistic" in scenario_label:
        scenario_name = "pessimistic"
    else:
        scenario_name = "realistic"

    # Portfolio weights: Spain 40%, others 15% each (can be changed by the user)
    base_weights = {
        "Spain": 0.40,
        "Hungary": 0.15,
        "Portugal": 0.15,
        "Italy": 0.15,
        "Poland": 0.15,
    }

    # Scenario-specific affordable housing assumptions
    scenario_params = {
        "realistic": {
            "Spain":   {"irr": 0.13, "cap": 0.0525, "infl": 0.025},
            "Hungary": {"irr": 0.15, "cap": 0.0550, "infl": 0.045},
            "Portugal":{"irr": 0.13, "cap": 0.0450, "infl": 0.022},
            "Italy":   {"irr": 0.12, "cap": 0.0600, "infl": 0.016},
            "Poland":  {"irr": 0.16, "cap": 0.0600, "infl": 0.037},
        },
        "optimistic": {
            "Spain":   {"irr": 0.16, "cap": 0.0450, "infl": 0.020},
            "Hungary": {"irr": 0.18, "cap": 0.0500, "infl": 0.030},
            "Portugal":{"irr": 0.16, "cap": 0.0400, "infl": 0.020},
            "Italy":   {"irr": 0.16, "cap": 0.0500, "infl": 0.015},
            "Poland":  {"irr": 0.20, "cap": 0.0550, "infl": 0.025},
        },
        "pessimistic": {
            "Spain":   {"irr": 0.10, "cap": 0.0650, "infl": 0.040},
            "Hungary": {"irr": 0.12, "cap": 0.0700, "infl": 0.060},
            "Portugal":{"irr": 0.10, "cap": 0.0575, "infl": 0.030},
            "Italy":   {"irr": 0.10, "cap": 0.0700, "infl": 0.030},
            "Poland":  {"irr": 0.12, "cap": 0.0700, "infl": 0.050},
        },
    }

    current_params = scenario_params[scenario_name]

    default_rows = []
    for country in ["Spain", "Hungary", "Portugal", "Italy", "Poland"]:
        p = current_params[country]
        default_rows.append(
            {
                "Country": country,
                "Weight": base_weights[country],
                "Dev Equity IRR (levered, 60% LTC)": p["irr"],
                "Exit Cap Rate (Year 3 & 53)": p["cap"],
                "Inflation (CPI, info only)": p["infl"],
            }
        )

    country_df = pd.DataFrame(default_rows)

    st.write(
        "The defaults below reflect **affordable housing** under a 30%-of-income rent cap. "
        "You can override IRRs, cap rates, inflation, or weights if you want to run sensitivities."
    )

    edited_df = st.data_editor(
        country_df,
        num_rows="dynamic",
        use_container_width=True,
        key="legacy_countries",
    )

    if edited_df["Weight"].sum() <= 0:
        st.error("The sum of 'Weight' must be positive.")
        return

    edited_df["Weight (norm)"] = edited_df["Weight"] / edited_df["Weight"].sum()

    # -----------------------------
    # Step 3 – Property-level dev costs & Year-3 values
    # -----------------------------
    st.subheader("Step 3 – Property-level Dev Costs & Year-3 Values")

    total_dev_cost = fund_equity_commitment / (1 - ltc)
    total_prop_debt0 = total_dev_cost * ltc
    total_project_equity0 = total_dev_cost * (1 - ltc)

    st.caption(
        f"Total development cost: **€{total_dev_cost:,.0f}**  \n"
        f"Property-level dev debt (LTC): **€{total_prop_debt0:,.0f}**  \n"
        f"Project equity (40% of cost): **€{total_project_equity0:,.0f}** "
        f"(fund 95% / developers 5%)."
    )

    rows = []
    total_project_equity_value3 = 0.0
    total_value3 = 0.0
    total_noi = 0.0
    total_purchase_5pct = 0.0

    for _, r in edited_df.iterrows():
        country = r["Country"]
        w = float(r["Weight (norm)"])
        dev_irr = float(r["Dev Equity IRR (levered, 60% LTC)"])
        cap = float(r["Exit Cap Rate (Year 3 & 53)"])
        infl = float(r["Inflation (CPI, info only)"])

        project_equity0_i = total_project_equity0 * w
        fund_equity0_i = project_equity0_i * 0.95
        dev_equity_developer0_i = project_equity0_i * 0.05

        dev_cost_i = total_dev_cost * w
        prop_debt0_i = dev_cost_i * ltc

        project_equity_value3_i = project_equity0_i * (1 + dev_irr) ** dev_years
        fund_equity_value3_i = project_equity_value3_i * 0.95
        value3_i = project_equity_value3_i + prop_debt0_i

        noi_i = value3_i * cap
        purchase_5pct_i = project_equity_value3_i * 0.05

        rows.append(
            {
                "Country": country,
                "Weight (norm)": w,
                "Dev IRR (levered equity)": dev_irr,
                "Inflation (info)": infl,
                "Project Equity0 [€]": project_equity0_i,
                "Fund Equity0 into Dev [€] (95%)": fund_equity0_i,
                "Developer Equity0 [€] (5%)": dev_equity_developer0_i,
                "Dev Cost [€]": dev_cost_i,
                "Dev Debt0 [€] (LTC)": prop_debt0_i,
                "Project Equity Value at Year 3 [€]": project_equity_value3_i,
                "Fund Equity Value at Year 3 [€] (95%)": fund_equity_value3_i,
                "Asset Value at Year 3 [€]": value3_i,
                "NOI at Year 3 [€]": noi_i,
                "Cost to buy 5% equity at Y3 [€]": purchase_5pct_i,
            }
        )

        total_project_equity_value3 += project_equity_value3_i
        total_value3 += value3_i
        total_noi += noi_i
        total_purchase_5pct += purchase_5pct_i

    dev_summary_df = pd.DataFrame(rows)
    st.dataframe(
        dev_summary_df.style.format(
            {
                "Dev IRR (levered equity)": "{:.2%}",
                "Inflation (info)": "{:.2%}",
                "Project Equity0 [€]": "€{:,.0f}",
                "Fund Equity0 into Dev [€] (95%)": "€{:,.0f}",
                "Developer Equity0 [€] (5%)": "€{:,.0f}",
                "Dev Cost [€]": "€{:,.0f}",
                "Dev Debt0 [€] (LTC)": "€{:,.0f}",
                "Project Equity Value at Year 3 [€]": "€{:,.0f}",
                "Fund Equity Value at Year 3 [€] (95%)": "€{:,.0f}",
                "Asset Value at Year 3 [€]": "€{:,.0f}",
                "NOI at Year 3 [€]": "€{:,.0f}",
                "Cost to buy 5% equity at Y3 [€]": "€{:,.0f}",
            }
        ),
        use_container_width=True,
    )

    st.info(
        f"**Aggregate at Year 3**  \n"
        f"- Project equity value: **€{total_project_equity_value3:,.0f}**  \n"
        f"- Property value: **€{total_value3:,.0f}**  \n"
        f"- NOI: **€{total_noi:,.0f}**  \n"
        f"- Cost to buy remaining 5% equity: **€{total_purchase_5pct:,.0f}**."
    )

    # -----------------------------
    # Step 4 – EIB schedule
    # -----------------------------
    st.subheader("Step 4 – EIB Schedule (Fund Level)")

    st.markdown(
        """
In this step we show how the **fund-level EIB loan** behaves under the two main structures:

- **Strategy A (Exit at Year 3)**  
  - Years 1–3: interest-only on the full EIB principal.  
  - Year 4: the principal is repaid in one shot when the portfolio is sold.

- **Strategy B (Legacy Fund)**  
  - Years 1–3: same interest-only period.  
  - From Year 4 onwards: the EIB loan converts into a **constant-payment mortgage (CPM)** amortised over the legacy holding period.
        """
    )

    def build_eib_schedule_for_strategy_B(principal: float, rate: float, dev_years: int, hold_years: int):
        total_T = dev_years + hold_years
        interest = [0.0] * (total_T + 1)
        principal_pay = [0.0] * (total_T + 1)
        payment = [0.0] * (total_T + 1)

        # Years 1–3: interest-only
        for t in range(1, dev_years + 1):
            interest[t] = rate * principal
            payment[t] = interest[t]
            principal_pay[t] = 0.0

        # Starting in year 4, convert to CPM over hold_years
        n_cpm = hold_years
        if n_cpm > 0 and rate > 0:
            ann_payment = -pmt(rate, n_cpm, pv_amt=principal, fv_amt=0.0, when="end")
        elif n_cpm > 0 and rate == 0:
            ann_payment = principal / n_cpm
        else:
            ann_payment = 0.0

        olb = principal
        for t in range(dev_years + 1, total_T + 1):
            int_t = rate * olb
            prin_t = ann_payment - int_t
            if prin_t > olb:
                prin_t = olb
                ann_t = int_t + prin_t
            else:
                ann_t = ann_payment
            interest[t] = int_t
            principal_pay[t] = prin_t
            payment[t] = ann_t
            olb -= prin_t
            if olb < 1e-6:
                olb = 0.0
        return interest, principal_pay, payment

    eib_int_B, eib_prin_B, eib_pay_B = build_eib_schedule_for_strategy_B(
        principal=eib_principal0,
        rate=eib_rate,
        dev_years=int(dev_years),
        hold_years=int(hold_years),
    )

    # Strategy A: interest-only years 1–3, then full repayment at Year 4
    eib_pay_A = [0.0] * (total_horizon + 1)
    eib_int_A = [0.0] * (total_horizon + 1)
    eib_prin_A = [0.0] * (total_horizon + 1)
    for t in range(1, int(dev_years) + 1):
        eib_int_A[t] = eib_rate * eib_principal0
        eib_pay_A[t] = eib_int_A[t]
    repay_year = int(dev_years) + 1
    if repay_year <= total_horizon:
        eib_prin_A[repay_year] = eib_principal0
        eib_pay_A[repay_year] += eib_principal0

    if len(eib_pay_B) < total_horizon + 1:
        eib_pay_B = eib_pay_B + [0.0] * (total_horizon + 1 - len(eib_pay_B))
        eib_int_B = eib_int_B + [0.0] * (total_horizon + 1 - len(eib_int_B))
        eib_prin_B = eib_prin_B + [0.0] * (total_horizon + 1 - len(eib_prin_B))
    else:
        eib_pay_B = eib_pay_B[: total_horizon + 1]
        eib_int_B = eib_int_B[: total_horizon + 1]
        eib_prin_B = eib_prin_B[: total_horizon + 1]

    eib_df = pd.DataFrame(
        {
            "Year": list(range(total_horizon + 1)),
            "EIB Interest A [€]": eib_int_A,
            "EIB Principal A [€]": eib_prin_A,
            "EIB Payment A [€]": eib_pay_A,
            "EIB Interest B [€]": eib_int_B,
            "EIB Principal B [€]": eib_prin_B,
            "EIB Payment B [€]": eib_pay_B,
        }
    )

    st.dataframe(
        eib_df.style.format(
            {
                "EIB Interest A [€]": "€{:,.0f}",
                "EIB Principal A [€]": "€{:,.0f}",
                "EIB Payment A [€]": "€{:,.0f}",
                "EIB Interest B [€]": "€{:,.0f}",
                "EIB Principal B [€]": "€{:,.0f}",
                "EIB Payment B [€]": "€{:,.0f}",
            }
        ),
        use_container_width=True,
    )

    st.caption(
        "Columns **A** correspond to Strategy A (exit Year 3, lump-sum repayment in Year 4), "
        "while columns **B** correspond to the Legacy Fund (Strategy B) where EIB is amortised over the 50-year holding."
    )

    # -----------------------------
    # Step 5 – 53-year property financing
    # -----------------------------
    st.subheader("Step 5 – 53-year Property-level Financing After Year 3")

    st.markdown(
        f"""
At Year 3, the **property-level development loans** are conceptually refinanced into a **53-year mortgage**:

- **Base loan**: long-term fixed-rate financing at **{prop_loan_rate*100:.2f}%**.  
- **Alt loan**: an alternative, more expensive refinancing at **{(alt_prop_rate or 0)*100:.2f}%**, e.g. a private bank loan or capital markets solution.

The loan amount is **LTC × Year-3 asset value**. Below we show the **annual property debt service** (interest + principal) under these two rates.
        """
    )

    prop_pay_base = [0.0] * (total_horizon + 1)
    prop_pay_spread = [0.0] * (total_horizon + 1) if alt_prop_rate is not None else None

    principal_prop = total_value3 * ltc
    n_loan = hold_years

    if n_loan > 0 and prop_loan_rate > 0:
        ann_base = -pmt(prop_loan_rate, n_loan, pv_amt=principal_prop, fv_amt=0.0, when="end")
    elif n_loan > 0 and prop_loan_rate == 0:
        ann_base = principal_prop / n_loan
    else:
        ann_base = 0.0

    for t in range(int(dev_years) + 1, total_horizon + 1):
        prop_pay_base[t] = ann_base

    if alt_prop_rate is not None:
        if n_loan > 0 and alt_prop_rate > 0:
            ann_spread = -pmt(alt_prop_rate, n_loan, pv_amt=principal_prop, fv_amt=0.0, when="end")
        elif n_loan > 0 and alt_prop_rate == 0:
            ann_spread = principal_prop / n_loan
        else:
            ann_spread = 0.0
        for t in range(int(dev_years) + 1, total_horizon + 1):
            prop_pay_spread[t] = ann_spread

    st.caption(
        f"Property-level refinancing at Year 3: principal **€{principal_prop:,.0f}** (LTC {ltc*100:.0f}%)."
    )

    prop_loan_df = pd.DataFrame(
        {
            "Year": list(range(total_horizon + 1)),
            "Base Property Debt Service [€]": prop_pay_base,
        }
    )
    if prop_pay_spread is not None:
        prop_loan_df["Alt Property Debt Service [€]"] = prop_pay_spread

    # show only first 10 years after refinancing for readability
    mask = (prop_loan_df["Year"] >= int(dev_years) + 1) & (
        prop_loan_df["Year"] <= min(total_horizon, int(dev_years) + 10)
    )
    st.dataframe(
        prop_loan_df.loc[mask].style.format(
            {
                "Base Property Debt Service [€]": "€{:,.0f}",
                "Alt Property Debt Service [€]": "€{:,.0f}",
            }
        ),
        use_container_width=True,
    )

    # -----------------------------
    # Step 6 – LP cashflows (pre-fees, pre-carry)
    # -----------------------------
    st.subheader("Step 6 – LP Cashflows for Strategies A & B (Pre-Fees & Pre-Carry)")

    st.markdown(
        f"""
We now compare the **fund-level LP cashflows** under six structural choices, all **before** management fees and carried interest:

1. **Strategy A – Exit at Year 3**  
   - Develop the projects, stabilise by Year 3, then **sell the fund’s equity stake** at Year 3.  
   - EIB is interest-only during development and repaid from sale proceeds (Year 4 in the schedule).

2. **Strategy B.1.a – Unencumbered asset, sell at Year 53**  
   - At Year 3 the fund conceptually **repays the development loans out of the property value** and buys the remaining 5% developer equity.  
   - After that, there is **no property-level debt**: the Legacy Fund holds an **unlevered asset** for 50 years.  
   - LPs receive **full NOI** every year plus **sale proceeds at Year 53**.

3. **Strategy B.2.a – Unencumbered asset, no sale**  
   - Same as B.1.a, but instead of selling, the asset is assumed to **revert to municipalities / social owners** at Year 53.  
   - LPs receive only NOI (no terminal sale cashflow).

4. **Strategy B.1.b – Base 53-year property loan, sell at Year 53**  
   - At Year 3, the fund **refinances** the properties with a 53-year mortgage at **{prop_loan_rate*100:.2f}%**.  
   - The new loan proceeds are used to **repay the development loans**, so equity is not hit a second time.  
   - From Year 4 onward, NOI services the long-term mortgage and the EIB loan; leftover cash goes to LPs.  
   - The asset is sold at Year 53 and the remaining mortgage balance is repaid; net proceeds go to LPs.

5. **Strategy B.2.b – Base 53-year property loan, no sale**  
   - Same as B.1.b but with **no terminal sale**: only net NOI after property debt is distributed.

6. **Optional: B.1.b & B.2.b with Alt Loan**  
   - Same as items 4 and 5, but the property-level mortgage uses the **higher alternative rate** {((alt_prop_rate or 0)*100):.2f}% (base + 250 bps).  
   - This represents a more expensive financing scenario (e.g. non-EIB or private lenders).

In all B strategies, the **development loan OLB at Year 3 is repaid out of the property value or refinancing proceeds**.  
Equity is always the **residual**: we are not asking LPs to write a second equity cheque at Year 3.

**Economic intuition**:

- **B.1.a (unencumbered)** – lower risk, highest annual cashflows, typically **lower IRR** (no leverage).  
- **B.1.b (levered)** – more risk, lower annual cashflows (debt service), but typically **higher IRR** when the **NOI yield exceeds the mortgage rate** (positive leverage).  
        """
    )

    # Year-3 internal balance sheet transition (V3 = D + E3)
    with st.expander("Show Year-3 internal balance sheet (V₃ = D + E₃)"):
        V3 = total_value3              # Asset Value at Year 3
        D_dev = total_prop_debt0       # Development Loan OLB at Year 3
        E3 = V3 - D_dev                # Equity created by development
        L53 = principal_prop           # 53-year loan = LTC × V3
        E3_levered = V3 - L53          # Equity if we keep L53 in place

        st.markdown(
            f"""
**Year-3 internal balance sheet (aggregated portfolio)**  

- Asset Value at Year 3 (V₃): **€{V3:,.0f}**  
- Development Loan OLB (D): **€{D_dev:,.0f}**  
- Equity from development (E₃ = V₃ − D): **€{E3:,.0f}**  

**Strategy B.1.a — Unencumbered Legacy Fund**

- New long-term property debt after Year 3: **€0**  
- Equity carried forward into the 50-year hold: **E₃ = €{E3:,.0f}**  

**Strategy B.1.b — Levered Legacy Fund (53-year loan at {prop_loan_rate*100:.2f}%)**

- New 53-year loan (L₅₃ = LTC × V₃): **€{L53:,.0f}**  
- Equity carried forward after refinancing: **V₃ − L₅₃ = €{E3_levered:,.0f}**  

In both cases, the **development loan is repaid out of the property value / refinancing at Year 3**.  
LPs do **not** write a new equity cheque at Year 3 — they simply decide whether to hold the asset
unlevered (B.1.a) or with a 53-year mortgage (B.1.b).
            """
        )

    def lp_metrics_from_cashflows(cf: List[float]) -> Tuple[float, float]:
        cfs = [CashFlow(t, cf[t]) for t in range(len(cf))]
        r = irr(cfs, guess=0.07, max_rate=5.0)
        neg = -sum(a for a in cf if a < 0)
        pos = sum(a for a in cf if a > 0)
        moic = pos / neg if neg > 0 else float("nan")
        return r, moic

    # Strategy A – exit at Year 3
    prop_cf_A = [0.0] * (total_horizon + 1)
    prop_cf_A[int(dev_years)] = total_project_equity_value3 * 0.95  # fund's equity value (95%)

    lp_cf_A = [0.0] * (total_horizon + 1)
    lp_cf_A[0] = -lp_initial
    for t in range(1, total_horizon + 1):
        lp_cf_A[t] = prop_cf_A[t] - eib_pay_A[t]

    irr_A, moic_A = lp_metrics_from_cashflows(lp_cf_A)

    # Strategy B – unencumbered (benchmark) & levered variants
    prop_cf_B_unlev = [0.0] * (total_horizon + 1)
    t3 = int(dev_years)

    # B.1.a / B.2.a: repay development debt + buy developer's 5% at Year 3 with equity (modeled at property level)
    prop_cf_B_unlev[t3] -= (total_purchase_5pct + total_prop_debt0)
    for t in range(t3 + 1, total_horizon + 1):
        prop_cf_B_unlev[t] += total_noi

    # B.1.a – sell at Year 53
    prop_cf_B1_unlev = prop_cf_B_unlev.copy()
    prop_cf_B1_unlev[total_horizon] += total_value3

    # B.2.a – no sale
    prop_cf_B2_unlev = prop_cf_B_unlev.copy()

    # B.1.b / B.2.b: refinance dev debt into 53y loan at base rate, then service that loan
    prop_cf_B_base = [0.0] * (total_horizon + 1)
    # At Year 3: new long-term mortgage raised (principal_prop), dev debt repaid, developer 5% bought
    prop_cf_B_base[t3] += principal_prop - total_prop_debt0 - total_purchase_5pct
    for t in range(t3 + 1, total_horizon + 1):
        prop_cf_B_base[t] += total_noi - prop_pay_base[t]

    prop_cf_B1_base = prop_cf_B_base.copy()
    prop_cf_B1_base[total_horizon] += total_value3

    prop_cf_B2_base = prop_cf_B_base.copy()

    # Alt property loan
    if prop_pay_spread is not None:
        prop_cf_B_spread = [0.0] * (total_horizon + 1)
        prop_cf_B_spread[t3] += principal_prop - total_prop_debt0 - total_purchase_5pct
        for t in range(t3 + 1, total_horizon + 1):
            prop_cf_B_spread[t] += total_noi - prop_pay_spread[t]

        prop_cf_B1_spread = prop_cf_B_spread.copy()
        prop_cf_B1_spread[total_horizon] += total_value3

        prop_cf_B2_spread = prop_cf_B_spread.copy()
    else:
        prop_cf_B1_spread = None
        prop_cf_B2_spread = None

    def build_lp_cf_from_prop_cf(prop_cf: List[float]) -> List[float]:
        cf = [0.0] * (total_horizon + 1)
        cf[0] = -lp_initial
        for t in range(1, total_horizon + 1):
            cf[t] = prop_cf[t] - eib_pay_B[t]
        return cf

    # Unencumbered
    lp_cf_B1_unlev = build_lp_cf_from_prop_cf(prop_cf_B1_unlev)
    irr_B1_unlev, moic_B1_unlev = lp_metrics_from_cashflows(lp_cf_B1_unlev)

    lp_cf_B2_unlev = build_lp_cf_from_prop_cf(prop_cf_B2_unlev)
    irr_B2_unlev, moic_B2_unlev = lp_metrics_from_cashflows(lp_cf_B2_unlev)

    # Base loan
    lp_cf_B1_base = build_lp_cf_from_prop_cf(prop_cf_B1_base)
    irr_B1_base, moic_B1_base = lp_metrics_from_cashflows(lp_cf_B1_base)

    lp_cf_B2_base = build_lp_cf_from_prop_cf(prop_cf_B2_base)
    irr_B2_base, moic_B2_base = lp_metrics_from_cashflows(lp_cf_B2_base)

    # Spread loan
    if prop_cf_B1_spread is not None:
        lp_cf_B1_spread = build_lp_cf_from_prop_cf(prop_cf_B1_spread)
        irr_B1_spread, moic_B1_spread = lp_metrics_from_cashflows(lp_cf_B1_spread)

        lp_cf_B2_spread = build_lp_cf_from_prop_cf(prop_cf_B2_spread)
        irr_B2_spread, moic_B2_spread = lp_metrics_from_cashflows(lp_cf_B2_spread)
    else:
        irr_B1_spread = moic_B1_spread = irr_B2_spread = moic_B2_spread = float("nan")

    # Diagnostics: negative leverage warning (option 2)
    if total_value3 > 0:
        implied_cap = total_noi / total_value3
        if prop_loan_rate > implied_cap + 1e-6:
            st.warning(
                f"⚠️ Potential negative leverage: implied cap rate (NOI / Value at Y3) ≈ {implied_cap*100:.2f}% "
                f"is **below** the property loan rate {prop_loan_rate*100:.2f}%. "
                "In this case, the levered strategy B.1.b can legitimately deliver a lower IRR than the unlevered B.1.a."
            )

    with st.expander("Show detailed LP cashflows (pre-fees & pre-carry)"):
        strategies_cf = {
            "A – Exit at Year 3": lp_cf_A,
            "B.1.a – Unencumb., sell Year 53": lp_cf_B1_unlev,
            "B.2.a – Unencumb., no sale": lp_cf_B2_unlev,
            "B.1.b – Base loan, sell Year 53": lp_cf_B1_base,
            "B.2.b – Base loan, no sale": lp_cf_B2_base,
        }
        if prop_cf_B1_spread is not None:
            strategies_cf["B.1.b – Alt loan, sell Year 53"] = lp_cf_B1_spread
            strategies_cf["B.2.b – Alt loan, no sale"] = lp_cf_B2_spread

        sel = st.selectbox("Select a strategy", list(strategies_cf.keys()))
        cf = strategies_cf[sel]
        df_cf = pd.DataFrame({"Year": range(len(cf)), "LP CF [€]": cf})
        st.dataframe(df_cf.style.format({"LP CF [€]": "€{:,.0f}"}), use_container_width=True)

    summary_rows = [
        ["A – Exit at Year 3", "EIB IO then repayment", "Sell Year 3", "N/A", irr_A, moic_A],
        ["B.1.a – Unencumb., sell Year 53", "EIB CPM", "Sell Year 53", "None", irr_B1_unlev, moic_B1_unlev],
        ["B.2.a – Unencumb., no sale", "EIB CPM", "No sale", "None", irr_B2_unlev, moic_B2_unlev],
        ["B.1.b – Base loan, sell Year 53", "EIB CPM + 53y loan", "Sell Year 53", f"{prop_loan_rate*100:.2f}%", irr_B1_base, moic_B1_base],
        ["B.2.b – Base loan, no sale", "EIB CPM + 53y loan", "No sale", f"{prop_loan_rate*100:.2f}%", irr_B2_base, moic_B2_base],
    ]
    if not math.isnan(irr_B1_spread):
        summary_rows.append(
            ["B.1.b – Alt loan, sell Year 53", "EIB CPM + 53y alt", "Sell Year 53", f"{alt_prop_rate*100:.2f}%", irr_B1_spread, moic_B1_spread]
        )
        summary_rows.append(
            ["B.2.b – Alt loan, no sale", "EIB CPM + 53y alt", "No sale", f"{alt_prop_rate*100:.2f}%", irr_B2_spread, moic_B2_spread]
        )

    summary_df = pd.DataFrame(
        summary_rows,
        columns=["Strategy", "Loan Structure", "Reversion", "Prop Loan Rate", "Nominal IRR (LP)", "MOIC (LP, x)"],
    )
    # Reorder: IRR & MOIC right after Strategy
    summary_df = summary_df[
        ["Strategy", "Nominal IRR (LP)", "MOIC (LP, x)", "Loan Structure", "Reversion", "Prop Loan Rate"]
    ]

    st.dataframe(
        summary_df.style.format(
            {
                "Nominal IRR (LP)": "{:.2%}",
                "MOIC (LP, x)": "{:.2f}",
            }
        ),
        use_container_width=True,
    )

    # -----------------------------
    # Step 7 – Fees & Carry (Waterfall A, no Preferred)
    # -----------------------------
    st.subheader("Step 7 – Fees, Carry & LP Class Splits (Waterfall A – No Preferred)")

    col_fee1, col_fee2, col_fee3, col_fee4 = st.columns(4)
    with col_fee1:
        founder_mgmt_fee_rate = st.number_input(
            "Founder/management fee",
            value=0.014,
            min_value=0.0,
            max_value=0.05,
            step=0.001,
            format="%.3f",
        )
    with col_fee2:
        bank_fee_rate = st.number_input(
            "Bank / custody fee",
            value=0.001,
            min_value=0.0,
            max_value=0.02,
            step=0.0005,
            format="%.4f",
        )
    with col_fee3:
        token_fee_rate = st.number_input(
            "Tokenization & distribution fee",
            value=0.005,
            min_value=0.0,
            max_value=0.05,
            step=0.001,
            format="%.3f",
        )
    with col_fee4:
        promote_rate = st.number_input(
            "Promote rate (carry on LP profit)",
            value=0.20,
            min_value=0.0,
            max_value=0.50,
            step=0.05,
            format="%.2f",
        )

    total_fee_rate = founder_mgmt_fee_rate + bank_fee_rate + token_fee_rate
    st.caption(
        f"Total annual fees: **{total_fee_rate*100:.2f}% of LP equity**, "
        f"i.e. **€{total_fee_rate*lp_initial:,.0f} per year** on the current Common Equity."
    )

    def metrics_from_cf(cf: List[float]):
        cfs = [CashFlow(t, cf[t]) for t in range(len(cf))]
        r = irr(cfs, guess=0.07, max_rate=5.0)
        neg = -sum(a for a in cf if a < 0)
        pos = sum(a for a in cf if a > 0)
        moic = pos / neg if neg > 0 else float("nan")
        return r, moic, neg, pos

    def apply_fees_and_carry_simple(lp_cf_gross: List[float],
                                    lp_initial_amt: float,
                                    exit_year: int,
                                    fee_rate: float,
                                    fee_years: int,
                                    promote_rate_val: float) -> Dict[str, List[float]]:
        n = len(lp_cf_gross)
        lp_cf_after_fees = lp_cf_gross.copy()
        founder_cf = [0.0] * n

        annual_fee = fee_rate * lp_initial_amt

        for t in range(1, min(fee_years, n - 1) + 1):
            lp_cf_after_fees[t] -= annual_fee
            founder_cf[t] += annual_fee

        _, _, total_in, total_out = metrics_from_cf(lp_cf_after_fees)
        profit_pre_carry = total_out - total_in
        gp_carry = max(promote_rate_val * profit_pre_carry, 0.0)

        lp_cf_net = lp_cf_after_fees.copy()
        if 0 <= exit_year < n:
            lp_cf_net[exit_year] -= gp_carry
            founder_cf[exit_year] += gp_carry

        seed_base = [0.0] * n
        other_base = [0.0] * n
        seed_alt = [0.0] * n
        other_alt = [0.0] * n
        for t in range(n):
            cf = lp_cf_net[t]
            seed_base[t] = 0.5 * cf
            other_base[t] = 0.5 * cf
            if cf < 0:
                seed_alt[t] = 0.5 * cf
                other_alt[t] = 0.5 * cf
            else:
                seed_alt[t] = 0.6 * cf
                other_alt[t] = 0.4 * cf

        return {
            "lp_net": lp_cf_net,
            "founder": founder_cf,
            "seed_base": seed_base,
            "other_base": other_base,
            "seed_alt": seed_alt,
            "other_alt": other_alt,
        }

    # Strategy A: fees during dev years only
    cfA = apply_fees_and_carry_simple(
        lp_cf_A,
        lp_initial_amt=lp_initial,
        exit_year=int(dev_years),
        fee_rate=total_fee_rate,
        fee_years=int(dev_years),
        promote_rate_val=promote_rate,
    )

    # Strategy B.1: fees for full 53-year horizon
    cfB1 = apply_fees_and_carry_simple(
        lp_cf_B1_unlev,
        lp_initial_amt=lp_initial,
        exit_year=total_horizon,
        fee_rate=total_fee_rate,
        fee_years=total_horizon,
        promote_rate_val=promote_rate,
    )

    # Strategy B.2: same fee pattern
    cfB2 = apply_fees_and_carry_simple(
        lp_cf_B2_unlev,
        lp_initial_amt=lp_initial,
        exit_year=total_horizon,
        fee_rate=total_fee_rate,
        fee_years=total_horizon,
        promote_rate_val=promote_rate,
    )

    def stakeholder_summary_simple(name: str, strategy_label: str, cf: List[float], exit_year: int) -> Dict[str, Any]:
        irr_val, moic_val, neg, pos = metrics_from_cf(cf)
        equity_invested = neg
        total_dist = pos
        reversion_cf = cf[exit_year] if 0 <= exit_year < len(cf) and cf[exit_year] > 0 else 0.0
        operating_cf = total_dist - reversion_cf
        return {
            "Stakeholder": name,
            "Strategy": strategy_label,
            "Equity Invested [€]": equity_invested,
            "Operating CF (Σ>0 excl. sale) [€]": operating_cf,
            "Reversion CF (sale) [€]": reversion_cf,
            "Total Distributions [€]": total_dist,
            "Net Profit [€]": total_dist - equity_invested,
            "IRR [%]": irr_val * 100.0,
            "MOIC [x]": moic_val,
        }

    rows_stake_A = []

    # Strategy A
    rows_stake_A.extend(
        [
            stakeholder_summary_simple("Founder (fees + carry)", "A: Exit Y3", cfA["founder"], int(dev_years)),
            stakeholder_summary_simple("All LPs (net fees & carry)", "A: Exit Y3", cfA["lp_net"], int(dev_years)),
            stakeholder_summary_simple("Seed LPs (base 50/50)", "A: Exit Y3", cfA["seed_base"], int(dev_years)),
            stakeholder_summary_simple("Other LPs (base 50/50)", "A: Exit Y3", cfA["other_base"], int(dev_years)),
            stakeholder_summary_simple("Seed LPs (uplift 60/40 profits)", "A: Exit Y3", cfA["seed_alt"], int(dev_years)),
            stakeholder_summary_simple("Other LPs (uplift 40/60 profits)", "A: Exit Y3", cfA["other_alt"], int(dev_years)),
        ]
    )

    # Strategy B.1
    rows_stake_A.extend(
        [
            stakeholder_summary_simple("Founder (fees + carry)", "B1: Sell Y53", cfB1["founder"], total_horizon),
            stakeholder_summary_simple("All LPs (net fees & carry)", "B1: Sell Y53", cfB1["lp_net"], total_horizon),
            stakeholder_summary_simple("Seed LPs (base 50/50)", "B1: Sell Y53", cfB1["seed_base"], total_horizon),
            stakeholder_summary_simple("Other LPs (base 50/50)", "B1: Sell Y53", cfB1["other_base"], total_horizon),
            stakeholder_summary_simple("Seed LPs (uplift 60/40 profits)", "B1: Sell Y53", cfB1["seed_alt"], total_horizon),
            stakeholder_summary_simple("Other LPs (uplift 40/60 profits)", "B1: Sell Y53", cfB1["other_alt"], total_horizon),
        ]
    )

    # Strategy B.2
    rows_stake_A.extend(
        [
            stakeholder_summary_simple("Founder (fees + carry)", "B2: Income only", cfB2["founder"], total_horizon),
            stakeholder_summary_simple("All LPs (net fees & carry)", "B2: Income only", cfB2["lp_net"], total_horizon),
            stakeholder_summary_simple("Seed LPs (base 50/50)", "B2: Income only", cfB2["seed_base"], total_horizon),
            stakeholder_summary_simple("Other LPs (base 50/50)", "B2: Income only", cfB2["other_base"], total_horizon),
            stakeholder_summary_simple("Seed LPs (uplift 60/40 profits)", "B2: Income only", cfB2["seed_alt"], total_horizon),
            stakeholder_summary_simple("Other LPs (uplift 40/60 profits)", "B2: Income only", cfB2["other_alt"], total_horizon),
        ]
    )

    stake_df_A = pd.DataFrame(rows_stake_A)

    # Reorder columns so IRR and MOIC appear right after Strategy
    cols_A = [
        "Stakeholder",
        "Strategy",
        "IRR [%]",
        "MOIC [x]",
        "Equity Invested [€]",
        "Operating CF (Σ>0 excl. sale) [€]",
        "Reversion CF (sale) [€]",
        "Total Distributions [€]",
        "Net Profit [€]",
    ]
    stake_df_A = stake_df_A[cols_A]

    st.markdown(
        """
We now look at **Waterfall A**, i.e. a structure **without Preferred Equity**.  
The table below reports **18 stakeholder scenarios**, combining:

- **3 investment strategies** for the Common Equity:
  - **A: Exit Y3** – harvest the 3-year development uplift.  
  - **B1: Sell Y53** – long-term hold with sale at the end of Year 53.  
  - **B2: Income only** – long-term hold with no terminal sale.

- **6 stakeholder group definitions** for each strategy:
  1. **Founder (fees + carry)** – receives the management fees and 20% promote on net LP profits.  
  2. **All LPs (net fees & carry)** – aggregate LP economics after fees and promote.  
  3. **Seed LPs (base 50/50)** – base case: Seed and Other LPs each own 50% of the Common.  
  4. **Other LPs (base 50/50)** – symmetric to Seed LPs in the base case.  
  5. **Seed LPs (uplift 60/40 profits)** – alternative scenario where Seed LPs receive **10% more** of profits than their capital weight (60/40 split on positive flows).  
  6. **Other LPs (uplift 40/60 profits)** – Other LPs receive **10% less** of profits than their capital weight.

For each scenario we decompose **operating cashflows vs reversion cashflow**, and show IRR/MOIC net of fees and carry.
        """
    )

    st.markdown("### Stakeholder-Level Results (Waterfall A – Net of Fees & Carry, No Preferred Equity)")
    st.dataframe(stake_df_A, use_container_width=True)

    # -----------------------------
    # Step 8 – Preferred Equity Scenario (Waterfall B)
    # -----------------------------
    st.subheader("Step 8 – Preferred Equity Scenario (Waterfall B – With Preferred Equity)")

    col_pref1, col_pref2, col_pref3 = st.columns(3)
    with col_pref1:
        pref_amount = st.number_input(
            "Preferred Equity amount [€]",
            value=1_000_000_000.0,
            step=50_000_000.0,
            format="%.0f",
            help="Additional Preferred Equity raised on top of the existing Common Equity.",
        )
    with col_pref2:
        pref_rate = st.number_input(
            "Preferred coupon rate",
            value=0.045,
            min_value=0.04,
            max_value=0.06,
            step=0.001,
            format="%.3f",
            help="Annual preferred return targeted by core investors.",
        )
    with col_pref3:
        fees_on_total_equity = st.checkbox(
            "Charge management fees on total equity (Common + Preferred)?",
            value=True,
        )

    st.markdown(
        f"""
In **Waterfall B**, we introduce **€{pref_amount:,.0f} of Preferred Equity** on top of the existing **€{lp_initial:,.0f} Common Equity**:

- **Preferred Equity**:
  - Contributes capital at Year 0.  
  - Receives an annual **coupon of {pref_rate*100:.2f}%** on the Preferred notional.  
  - At the terminal event (Year 53), it is fully repaid (principal) before Common receives anything.

- **Common Equity (original LPs)**:
  - Continues to bear the residual upside and downside after the Preferred layer is honoured.  
  - Still pays the **2% management/operating fee** (on either Common or total equity, depending on the toggle).  
  - Pays **20% promote** on Common-level profits to the Founder.

The table below reports **6+ stakeholder scenarios** under this Preferred structure:
1. **Founder (fees + carry)** – all fee income plus promote on the Common.  
2. **Preferred Equity** – coupon + return of capital.  
3. **Common (all LPs)** – aggregate Common economics after fees and carry.  
4. **Seed LPs (base 50/50)** – Seed LPs’ share of Common cashflows assuming a 50/50 allocation of Common.  
5. **Other LPs (base 50/50)** – Other LPs’ share under the same 50/50 allocation.  
6. **Seed/Other LPs (uplift 60/40 vs 40/60)** – the Seed uplift scenario applied to the **Common** cashflows only.
        """
    )

    total_equity_B = lp_initial + pref_amount
    equity_scale = total_equity_B / lp_initial if lp_initial > 0 else 0.0

    total_equity_cf_B1 = [cf * equity_scale for cf in lp_cf_B1_unlev]

    nT = total_horizon + 1
    founder_B = [0.0] * nT
    pref_B = [0.0] * nT
    common_B = [0.0] * nT

    pref_B[0] = -pref_amount
    common_B[0] = -lp_initial

    fee_base_B = total_equity_B if fees_on_total_equity else lp_initial
    annual_fee_B = total_fee_rate * fee_base_B

    for t in range(1, total_horizon):
        equity_pool = total_equity_cf_B1[t]
        equity_pool_after_fee = equity_pool - annual_fee_B
        founder_B[t] += annual_fee_B

        coupon_t = pref_rate * pref_amount
        equity_pool_after_coupon = equity_pool_after_fee - coupon_t
        pref_B[t] += coupon_t

        common_B[t] += equity_pool_after_coupon

    T = total_horizon
    equity_pool = total_equity_cf_B1[T]
    equity_pool_after_fee = equity_pool - annual_fee_B
    founder_B[T] += annual_fee_B

    coupon_T = pref_rate * pref_amount
    equity_pool_after_coupon = equity_pool_after_fee - coupon_T
    pref_B[T] += coupon_T

    equity_pool_after_pref_principal = equity_pool_after_coupon - pref_amount
    pref_B[T] += pref_amount

    equity_pool_after_common_principal = equity_pool_after_pref_principal - lp_initial
    common_B[T] += lp_initial

    profit_common_pre_carry = equity_pool_after_common_principal
    gp_carry_B = max(promote_rate * profit_common_pre_carry, 0.0)
    equity_pool_after_carry = profit_common_pre_carry - gp_carry_B

    founder_B[T] += gp_carry_B
    common_B[T] += equity_pool_after_carry

    def split_seed_other_common(cf: List[float]):
        n = len(cf)
        seed_base = [0.0] * n
        other_base = [0.0] * n
        seed_alt = [0.0] * n
        other_alt = [0.0] * n
        for tt in range(n):
            c = cf[tt]
            seed_base[tt] = 0.5 * c
            other_base[tt] = 0.5 * c
            if c < 0:
                seed_alt[tt] = 0.5 * c
                other_alt[tt] = 0.5 * c
            else:
                seed_alt[tt] = 0.6 * c
                other_alt[tt] = 0.4 * c
        return seed_base, other_base, seed_alt, other_alt

    seed_base_B, other_base_B, seed_alt_B, other_alt_B = split_seed_other_common(common_B)

    def stakeholder_summary_simple(name: str, strategy_label: str, cf: List[float], exit_year: int) -> Dict[str, Any]:
        irr_val, moic_val, neg, pos = metrics_from_cf(cf)
        equity_invested = neg
        total_dist = pos
        reversion_cf = cf[exit_year] if 0 <= exit_year < len(cf) and cf[exit_year] > 0 else 0.0
        operating_cf = total_dist - reversion_cf
        return {
            "Stakeholder": name,
            "Strategy": strategy_label,
            "Equity Invested [€]": equity_invested,
            "Operating CF (Σ>0 excl. sale) [€]": operating_cf,
            "Reversion CF (sale) [€]": reversion_cf,
            "Total Distributions [€]": total_dist,
            "Net Profit [€]": total_dist - equity_invested,
            "IRR [%]": irr_val * 100.0,
            "MOIC [x]": moic_val,
        }

    rows_stake_B = []
    rows_stake_B.extend(
        [
            stakeholder_summary_simple("Founder (fees + carry)", "B1: Sell Y53 (Pref)", founder_B, T),
            stakeholder_summary_simple("Preferred Equity", "B1: Sell Y53 (Pref)", pref_B, T),
            stakeholder_summary_simple("Common (all LPs)", "B1: Sell Y53 (Pref)", common_B, T),
            stakeholder_summary_simple("Seed LPs (base 50/50)", "B1: Sell Y53 (Pref)", seed_base_B, T),
            stakeholder_summary_simple("Other LPs (base 50/50)", "B1: Sell Y53 (Pref)", other_base_B, T),
            stakeholder_summary_simple("Seed LPs (uplift 60/40 profits)", "B1: Sell Y53 (Pref)", seed_alt_B, T),
            stakeholder_summary_simple("Other LPs (uplift 40/60 profits)", "B1: Sell Y53 (Pref)", other_alt_B, T),
        ]
    )

    stake_df_B = pd.DataFrame(rows_stake_B)

    # Reorder columns so IRR and MOIC appear right after Strategy
    cols_B = [
        "Stakeholder",
        "Strategy",
        "IRR [%]",
        "MOIC [x]",
        "Equity Invested [€]",
        "Operating CF (Σ>0 excl. sale) [€]",
        "Reversion CF (sale) [€]",
        "Total Distributions [€]",
        "Net Profit [€]",
    ]
    stake_df_B = stake_df_B[cols_B]

    st.markdown("### Stakeholder-Level Results (Waterfall B – With €1bn Preferred Equity)")
    st.dataframe(stake_df_B, use_container_width=True)

    noi_scaled = total_noi * equity_scale
    pref_coupon_total = pref_rate * pref_amount
    if pref_coupon_total > 0:
        coverage = noi_scaled / pref_coupon_total
        st.caption(
            f"Approximate Preferred coupon coverage (based on scaled NOI): NOI / Pref coupon ≈ **{coverage:.2f}×**."
        )

    # -----------------------------
    # Step 9 – Decision Tree (Waterfall A, vertical)
    # -----------------------------
    st.subheader("Step 9 – Decision Tree (LP Perspective – Waterfall A, No Preferred)")

    try:
        dot = graphviz.Digraph(format="png")
        # default rankdir is top-to-bottom (vertical)
        dot.attr(fontsize="13")

        dot.node(
            "start",
            f"Year 0\nLPs commit €{lp_initial:,.0f}\nEIB lends €{eib_principal0:,.0f}\nTotal Dev Cost €{total_dev_cost:,.0f}",
            shape="box",
            style="filled",
            fillcolor="#E3F2FD",
        )

        dot.node(
            "y3",
            f"End of Year {int(dev_years)}\nProject stabilised\nFund owns 95% dev equity",
            shape="ellipse",
            style="filled",
            fillcolor="#E8F5E9",
        )

        label_A = (
            "Strategy A\n"
            "Exit at Year 3\n"
            f"LP IRR (pre-fees/carry): {irr_A*100:.1f}%\n"
            f"LP MOIC: {moic_A:.2f}x"
        )
        dot.node(
            "A",
            label_A,
            shape="box",
            style="filled",
            fillcolor="#FFF3E0",
        )

        label_B1 = (
            "Strategy B.1\n"
            "Hold 50y, sell at Year 53\n"
            f"Unenc: IRR {irr_B1_unlev*100:.1f}%, MOIC {moic_B1_unlev:.2f}x\n"
            f"Base loan: IRR {irr_B1_base*100:.1f}%, MOIC {moic_B1_base:.2f}x"
        )
        if not math.isnan(irr_B1_spread):
            label_B1 += f"\nAlt loan: IRR {irr_B1_spread*100:.1f}%, MOIC {moic_B1_spread:.2f}x"

        dot.node(
            "B1",
            label_B1,
            shape="box",
            style="filled",
            fillcolor="#E0F7FA",
        )

        label_B2 = (
            "Strategy B.2\n"
            "Hold 50y, no sale\n"
            f"Unenc: IRR {irr_B2_unlev*100:.1f}%, MOIC {moic_B2_unlev:.2f}x\n"
            f"Base loan: IRR {irr_B2_base*100:.1f}%, MOIC {moic_B2_base:.2f}x"
        )
        if not math.isnan(irr_B2_spread):
            label_B2 += f"\nAlt loan: IRR {irr_B2_spread*100:.1f}%, MOIC {moic_B2_spread:.2f}x"

        dot.node(
            "B2",
            label_B2,
            shape="box",
            style="filled",
            fillcolor="#F3E5F5",
        )

        dot.edge("start", "y3", label="Develop + Stabilise")
        dot.edge("y3", "A", label="Sell at Year 3")
        dot.edge("y3", "B1", label="Hold & sell at Year 53")
        dot.edge("y3", "B2", label="Hold, income only")

        st.graphviz_chart(dot, use_container_width=True)
    except Exception as e:
        st.warning(f"Could not render decision tree: {e}")

    # -----------------------------
    # Step 10 – Export to Excel
    # -----------------------------
    st.markdown("---")
    st.caption("Optional: export Legacy Fund results to Excel.")

    up_xlsx = st.file_uploader("Upload an Excel template (optional)", type=["xlsx"], key="legacy_xlsx_uploader")

    if st.button("Export Legacy Fund results to Excel"):
        template_bytes = up_xlsx.read() if up_xlsx is not None else None

        dfs = {
            "Dev_Summary": dev_summary_df,
            "LP_Strategy_Summary": summary_df,
            "Stakeholder_WaterfallA": stake_df_A,
            "Stakeholder_WaterfallB": stake_df_B,
        }
        scalars = {
            "LP Development Equity [€]": lp_equity_commitment,
            "EIB Principal [€]": eib_principal0,
            "Fund Dev Equity into Projects [€]": fund_equity_commitment,
            "LTC": ltc,
            "EIB Rate": eib_rate,
            "Development Loan Rate (3y IO)": dev_loan_rate,
            "53y Property Loan Rate (base)": prop_loan_rate,
            "53y Property Loan Rate (alt)": alt_prop_rate if alt_prop_rate is not None else float("nan"),
            "Total Dev Cost [€]": total_dev_cost,
            "Total Property Debt0 [€]": total_prop_debt0,
            "Total Fund Equity Value at Year 3 [€]": total_project_equity_value3,
            "Total Property Value at Year 3 [€]": total_value3,
            "Total NOI [€]": total_noi,
            "Cost to Buy 5% at Year 3 [€]": total_purchase_5pct,
            "LP IRR Strategy A": irr_A,
            "LP MOIC Strategy A": moic_A,
            "Fee_Rate_Total": total_fee_rate,
            "Promote_Rate": promote_rate,
            "Preferred_Amount": pref_amount,
            "Preferred_Rate": pref_rate,
        }

        export_results_to_excel(template_bytes, dfs, scalars, "LegacyFund_Results.xlsx")


# ------------------------------------------------------------
# MAIN APP LAYOUT
# ------------------------------------------------------------
def main():
    st.sidebar.title("ReFi AI — Modules I–III & Legacy Fund")

    module = st.sidebar.selectbox(
        "Select a module:",
        [
            "Module 1 — Property-Level Valuation & Ranking",
            "Module 2 — Levered Returns (Debt & DSCR)",
            "Module 3 — Mortgage Lab (V2)",
            "Module 4 — Mortgage Choice in Barcelona (Instructor Version)",
            "Module 4B — Barcelona Market Explorer",
            "Legacy Fund — European Affordable Housing",
            "Ask the AI Teacher for Help",
        ],
    )

    if module == "Module 1 — Property-Level Valuation & Ranking":
        render_module_1_v3()

    elif module == "Module 2 — Levered Returns (Debt & DSCR)":
        render_module_2_v2()

    elif module == "Module 3 — Mortgage Lab (V2)":
        render_module_3_v2()

    elif module == "Module 4 — Mortgage Choice in Barcelona (Instructor Version)":
        render_module_iii()

    elif module == "Module 4B — Barcelona Market Explorer":
        render_module_barcelona()

    elif module == "Legacy Fund — European Affordable Housing":
        render_legacy_fund_module()

    elif module == "Ask the AI Teacher for Help":
        render_ai_teacher_chat()


if __name__ == "__main__":
    main()
