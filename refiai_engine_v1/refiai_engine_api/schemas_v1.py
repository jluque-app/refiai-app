from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, conint, confloat, root_validator, validator


class ModelId(str, Enum):
    module1_property_v1 = "module1_property_v1"
    module2_levered_returns_v1 = "module2_levered_returns_v1"
    module3_mortgage_lab_v1 = "module3_mortgage_lab_v1"
    module4_capital_stack_waterfall_v1 = "module4_capital_stack_waterfall_v1"
    barcelona_case_v1 = "barcelona_case_v1"
    legacy_fund_v1 = "legacy_fund_v1"


class WarningSeverity(str, Enum):
    info = "info"
    warning = "warning"
    error = "error"


class WarningMsg(BaseModel):
    code: str
    message: str
    severity: WarningSeverity = WarningSeverity.warning
    context: Dict[str, Any] = Field(default_factory=dict)


class RunIncludeOptions(BaseModel):
    scalars: bool = True
    tables: bool = True
    series: bool = True
    debug: bool = False


class RunOptions(BaseModel):
    include: RunIncludeOptions = Field(default_factory=RunIncludeOptions)


class RunRequest(BaseModel):
    model_id: ModelId
    inputs: Dict[str, Any]
    options: RunOptions = Field(default_factory=RunOptions)


class RunResponse(BaseModel):
    engine_version: str
    model_id: ModelId
    model_version: str
    input_fingerprint: str
    warnings: List[WarningMsg] = Field(default_factory=list)

    scalars: Dict[str, float] = Field(default_factory=dict)
    tables: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)
    series: Dict[str, List[float]] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------
# Shared small structs
# ---------------------------

class MetaYears(BaseModel):
    scenario_name: str = "Default"
    analysis_years: conint(ge=1, le=100) = 10


class MetaScenarioOnly(BaseModel):
    scenario_name: str = "Default"


class IRRParams(BaseModel):
    guess: confloat(ge=-0.99, le=10.0) = 0.10
    max_rate: confloat(gt=0.0, le=100.0) = 5.0


# ---------------------------
# Module 1
# ---------------------------

class M1Purchase(BaseModel):
    purchase_price: confloat(gt=0) = 10_000_000
    acquisition_costs_pct: confloat(ge=0, lt=1) = 0.02


class M1Operations(BaseModel):
    year1_gross_income: confloat(gt=0) = 900_000
    income_growth_rate: confloat(ge=-0.50, le=0.50) = 0.03
    vacancy_rate: confloat(ge=0, lt=1) = 0.05
    opex_ratio: confloat(ge=0, lt=1) = 0.35
    capex_ratio: confloat(ge=0, lt=1) = 0.03


class M1Exit(BaseModel):
    exit_cap_rate: confloat(gt=0, lt=0.50) = 0.055
    sale_costs_pct: confloat(ge=0, lt=1) = 0.02


class M1Discounting(BaseModel):
    discount_rate: confloat(ge=-0.50, le=1.00) = 0.08


class Module1Inputs(BaseModel):
    meta: MetaYears = Field(default_factory=MetaYears)
    purchase: M1Purchase = Field(default_factory=M1Purchase)
    operations: M1Operations = Field(default_factory=M1Operations)
    exit: M1Exit = Field(default_factory=M1Exit)
    discounting: M1Discounting = Field(default_factory=M1Discounting)
    irr: IRRParams = Field(default_factory=IRRParams)


# ---------------------------
# Module 2
# ---------------------------

class M2Debt(BaseModel):
    sizing_mode: Literal["ltv", "loan_amount"] = "ltv"
    ltv: Optional[confloat(gt=0, lt=1)] = 0.65
    loan_amount: Optional[confloat(gt=0)] = None

    interest_rate: confloat(ge=0, le=1.0) = 0.055
    amort_years: conint(ge=1, le=60) = 30
    io_years: conint(ge=0, le=30) = 0
    origination_fee_pct: confloat(ge=0, lt=1) = 0.01

    @root_validator
    def _validate_sizing_mode(cls, values):
        mode = values.get("sizing_mode")
        if mode == "ltv" and values.get("ltv") is None:
            raise ValueError("debt.ltv must be provided when sizing_mode='ltv'")
        if mode == "loan_amount" and values.get("loan_amount") is None:
            raise ValueError("debt.loan_amount must be provided when sizing_mode='loan_amount'")
        return values


class M2Refinance(BaseModel):
    enabled: bool = False
    refi_year: conint(ge=1, le=100) = 5
    refi_ltv: confloat(gt=0, lt=1) = 0.65
    refi_rate: confloat(ge=0, le=1.0) = 0.055
    refi_amort_years: conint(ge=1, le=60) = 30
    refi_fee_pct: confloat(ge=0, lt=1) = 0.01


class Module2Inputs(BaseModel):
    meta: MetaYears = Field(default_factory=MetaYears)
    purchase: M1Purchase = Field(default_factory=M1Purchase)
    operations: M1Operations = Field(default_factory=M1Operations)
    exit: M1Exit = Field(default_factory=M1Exit)
    debt: M2Debt = Field(default_factory=M2Debt)
    refinance: M2Refinance = Field(default_factory=M2Refinance)
    irr: IRRParams = Field(default_factory=IRRParams)


# ---------------------------
# Module 3
# ---------------------------

class LoanCore(BaseModel):
    balance: confloat(gt=0) = 5_000_000
    term_months: conint(ge=1, le=720) = 360
    rate_annual: confloat(ge=0, le=1.0) = 0.055


class ARMParams(BaseModel):
    enabled: bool = False
    fixed_months: conint(ge=0, le=600) = 60
    reset_frequency_months: conint(ge=1, le=60) = 12
    margin: confloat(ge=0, le=1.0) = 0.02
    index_rate_annual: confloat(ge=0, le=1.0) = 0.03
    periodic_cap: confloat(ge=0, le=1.0) = 0.02
    lifetime_cap: confloat(ge=0, le=2.0) = 0.05
    floor: confloat(ge=0, le=1.0) = 0.0


class MortgageStructure(BaseModel):
    type: Literal["FRM", "IO", "CA", "CPM", "ARM"] = "FRM"
    io_months: conint(ge=0, le=600) = 0
    arm: ARMParams = Field(default_factory=ARMParams)


class Prepayment(BaseModel):
    mode: Literal["none", "cpr", "psa"] = "none"
    cpr_annual: confloat(ge=0, le=1.0) = 0.0
    psa: confloat(ge=0, le=10.0) = 0.0


class Refi(BaseModel):
    enabled: bool = False
    new_rate_annual: confloat(ge=0, le=1.0) = 0.045
    refi_costs: confloat(ge=0) = 20_000
    discount_rate_annual: confloat(ge=-0.50, le=1.0) = 0.06


class Module3Inputs(BaseModel):
    meta: MetaScenarioOnly = Field(default_factory=MetaScenarioOnly)
    loan: LoanCore = Field(default_factory=LoanCore)
    structure: MortgageStructure = Field(default_factory=MortgageStructure)
    prepayment: Prepayment = Field(default_factory=Prepayment)
    refi: Refi = Field(default_factory=Refi)


# ---------------------------
# Module 4
# ---------------------------

class DealCashflows(BaseModel):
    period_years: List[conint(ge=0, le=200)] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5])
    cashflows_to_equity: List[float] = Field(default_factory=lambda: [-1_000_000, 0, 0, 200_000, 200_000, 1_500_000])

    @validator("cashflows_to_equity")
    def _len_match(cls, v, values):
        yrs = values.get("period_years", [])
        if yrs and len(v) != len(yrs):
            raise ValueError("deal_cashflows.cashflows_to_equity must have same length as period_years")
        return v


class PreferredEquity(BaseModel):
    enabled: bool = True
    amount: confloat(ge=0) = 500_000
    coupon_rate: confloat(ge=0, le=1.0) = 0.08
    pay_current: bool = False


class CapitalStack(BaseModel):
    common_equity: confloat(gt=0) = 1_000_000
    preferred_equity: PreferredEquity = Field(default_factory=PreferredEquity)


class Tier(BaseModel):
    hurdle_irr: confloat(ge=-0.99, le=10.0) = 0.08
    promote_gp_pct: confloat(ge=0, le=1.0) = 0.0
    catchup: bool = False


class Waterfall(BaseModel):
    structure: Literal["european"] = "european"
    lp_share: confloat(gt=0, lt=1) = 0.80
    gp_share: confloat(gt=0, lt=1) = 0.20
    tiers: List[Tier] = Field(default_factory=lambda: [
        Tier(hurdle_irr=0.08, promote_gp_pct=0.0, catchup=False),
        Tier(hurdle_irr=0.15, promote_gp_pct=0.20, catchup=True),
        Tier(hurdle_irr=0.999, promote_gp_pct=0.30, catchup=False),
    ])

    @root_validator
    def _shares_sum(cls, values):
        if abs(values["lp_share"] + values["gp_share"] - 1.0) > 1e-9:
            raise ValueError("waterfall.lp_share + waterfall.gp_share must equal 1.0")
        return values


class Module4Inputs(BaseModel):
    meta: MetaScenarioOnly = Field(default_factory=MetaScenarioOnly)
    deal_cashflows: DealCashflows = Field(default_factory=DealCashflows)
    capital_stack: CapitalStack = Field(default_factory=CapitalStack)
    waterfall: Waterfall = Field(default_factory=Waterfall)
    irr: IRRParams = Field(default_factory=IRRParams)


# ---------------------------
# Barcelona (Exec-only)
# ---------------------------

class BarcelonaTimeline(BaseModel):
    months: conint(ge=1, le=240) = 60


class BarcelonaPurchase(BaseModel):
    purchase_price: confloat(gt=0) = 1_200_000
    purchase_costs: confloat(ge=0) = 80_000


class BarcelonaCapex(BaseModel):
    reno_budget: confloat(ge=0) = 150_000
    reno_months: conint(ge=0, le=36) = 4


class BarcelonaRevenue(BaseModel):
    mode: Literal["str"] = "str"
    adr: confloat(gt=0) = 220
    occupancy: confloat(ge=0, le=1.0) = 0.70
    annual_growth: confloat(ge=-0.50, le=0.50) = 0.02


class BarcelonaCosts(BaseModel):
    opex_monthly: confloat(ge=0) = 2_500
    platform_fee_pct: confloat(ge=0, lt=1) = 0.03
    mgmt_fee_pct: confloat(ge=0, lt=1) = 0.10


class BarcelonaFinancing(BaseModel):
    loan_amount: confloat(ge=0) = 700_000
    rate_annual: confloat(ge=0, le=1.0) = 0.0525
    term_months: conint(ge=1, le=720) = 300
    io_months: conint(ge=0, le=360) = 24
    origination_fee_pct: confloat(ge=0, lt=1) = 0.01


class BarcelonaExit(BaseModel):
    exit_month: conint(ge=1, le=240) = 60
    sale_costs_pct: confloat(ge=0, lt=1) = 0.03
    exit_cap_rate: confloat(gt=0, lt=0.50) = 0.055


class BarcelonaInputs(BaseModel):
    meta: MetaScenarioOnly = Field(default_factory=MetaScenarioOnly)
    timeline: BarcelonaTimeline = Field(default_factory=BarcelonaTimeline)
    purchase: BarcelonaPurchase = Field(default_factory=BarcelonaPurchase)
    capex: BarcelonaCapex = Field(default_factory=BarcelonaCapex)
    revenue: BarcelonaRevenue = Field(default_factory=BarcelonaRevenue)
    costs: BarcelonaCosts = Field(default_factory=BarcelonaCosts)
    financing: BarcelonaFinancing = Field(default_factory=BarcelonaFinancing)
    exit: BarcelonaExit = Field(default_factory=BarcelonaExit)
    irr: IRRParams = Field(default_factory=IRRParams)


# ---------------------------
# Legacy Fund (Exec-only)
# ---------------------------

class FundCore(BaseModel):
    lp_seed_equity: confloat(gt=0) = 5_000_000_000
    dev_years: conint(ge=1, le=10) = 3
    hold_years: conint(ge=1, le=100) = 50
    ltc: confloat(gt=0, lt=1) = 0.60


class LegacyRates(BaseModel):
    development_loan_rate: confloat(ge=0, le=1.0) = 0.05
    property_loan_rate_base: confloat(ge=0, le=1.0) = 0.045
    property_loan_rate_alt: confloat(ge=0, le=1.0) = 0.060
    eib_rate: confloat(ge=0, le=1.0) = 0.02


class CapitalPrograms(BaseModel):
    eib_share_of_total_fund_capital: confloat(ge=0, le=0.95) = 0.40
    eib_share_of_dev_cost: Optional[confloat(ge=0, le=1.0)] = None


class LegacyStrategies(BaseModel):
    compute_strategy_A: bool = True
    compute_strategy_B1: bool = True
    compute_strategy_B2: bool = True
    include_alt_property_rate_case: bool = True


class LegacyFees(BaseModel):
    founder_mgmt_fee_rate: confloat(ge=0, lt=1) = 0.02
    bank_fee_rate: confloat(ge=0, lt=1) = 0.005
    token_fee_rate: confloat(ge=0, lt=1) = 0.005
    promote_rate: confloat(ge=0, le=1) = 0.20


class LegacyPreferred(BaseModel):
    enabled: bool = False
    pref_amount: confloat(ge=0) = 250_000_000.0
    pref_rate: confloat(ge=0, le=1.0) = 0.045
    fees_on_total_equity: bool = True


class CountryMixRow(BaseModel):
    country: str
    weight: confloat(ge=0) = 0.0
    dev_irr: confloat(ge=-0.99, le=10.0) = 0.13
    exit_cap_rate: confloat(gt=0, lt=0.50) = 0.0525
    inflation: confloat(ge=-0.50, le=1.0) = 0.025


class LegacyMeta(BaseModel):
    scenario_name: str = "Realistic"
    currency: str = "EUR"


class LegacyFundInputs(BaseModel):
    meta: LegacyMeta = Field(default_factory=LegacyMeta)
    fund: FundCore = Field(default_factory=FundCore)
    rates: LegacyRates = Field(default_factory=LegacyRates)
    capital_programs: CapitalPrograms = Field(default_factory=CapitalPrograms)
    strategies: LegacyStrategies = Field(default_factory=LegacyStrategies)
    fees: LegacyFees = Field(default_factory=LegacyFees)
    preferred_equity: LegacyPreferred = Field(default_factory=LegacyPreferred)
    country_mix: List[CountryMixRow] = Field(default_factory=list)
    irr: IRRParams = Field(default_factory=IRRParams)


MODEL_INPUT_SCHEMA = {
    ModelId.module1_property_v1: Module1Inputs,
    ModelId.module2_levered_returns_v1: Module2Inputs,
    ModelId.module3_mortgage_lab_v1: Module3Inputs,
    ModelId.module4_capital_stack_waterfall_v1: Module4Inputs,
    ModelId.barcelona_case_v1: BarcelonaInputs,
    ModelId.legacy_fund_v1: LegacyFundInputs,
}
