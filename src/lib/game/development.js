/**
 * development.js — real estate development finance for ReFiAI Tycoon, Season 2 (Paris).
 * Mirrors the Advanced Topics unit "Real Estate Development Finance": the development
 * process and J-curve, front-door vs back-door feasibility, ADC (acquisition, development,
 * construction) financing with capitalised interest, and the real option to wait.
 * Pure functions, no dependencies. Money in €, rates as decimals, time in quarters.
 */
import { irr } from "./finance-core.js";

const PPY = 4;

/* ---------------------------------------------------------------------------------
 * Cost build-up
 * ------------------------------------------------------------------------------- */

/**
 * Non-land development cost.
 * @param {object} p
 * @param {number} p.buildableM2         gross floor area to build
 * @param {number} p.hardCostPerM2       construction cost per built m²
 * @param {number} [p.softCostPct=0.15]  design, permits, fees — as a share of hard cost
 * @param {number} [p.financingPct=0.06] proxy for capitalised interest — share of (hard+soft)
 * @returns {{hard:number, soft:number, financing:number, nonLand:number}}
 */
export function nonLandCost({ buildableM2, hardCostPerM2, softCostPct = 0.15, financingPct = 0.06 }) {
  const hard = buildableM2 * hardCostPerM2;
  const soft = hard * softCostPct;
  const financing = (hard + soft) * financingPct;
  return { hard, soft, financing, nonLand: hard + soft + financing };
}

/* ---------------------------------------------------------------------------------
 * Feasibility — the two doors
 * ------------------------------------------------------------------------------- */

/**
 * FRONT-DOOR: start from cost, ask what rent the project NEEDS.
 *   Required NOI  = Total Development Cost × required yield-on-cost
 *   Required rent = Required NOI ÷ NOI margin ÷ leasable m² ÷ 12
 * Feasible when required rent ≤ market rent.
 * @param {object} p
 * @param {number} p.landCost
 * @param {number} p.buildableM2
 * @param {number} p.leasableM2          net lettable area (efficiency × buildable)
 * @param {number} p.hardCostPerM2
 * @param {number} p.marketRentPerM2Month
 * @param {number} p.targetYieldOnCost   e.g. exit cap + 150 bps development premium
 * @param {number} [p.noiMargin=0.75]    NOI as a share of gross rent
 * @param {number} [p.stabilizedOccupancy=1]
 * @param {number} [p.softCostPct=0.15]
 * @param {number} [p.financingPct=0.06]
 */
export function frontDoor({ landCost, buildableM2, leasableM2, hardCostPerM2, marketRentPerM2Month,
  targetYieldOnCost, noiMargin = 0.75, stabilizedOccupancy = 1, softCostPct = 0.15, financingPct = 0.06 }) {
  const c = nonLandCost({ buildableM2, hardCostPerM2, softCostPct, financingPct });
  const tdc = landCost + c.nonLand;
  const requiredNOI = tdc * targetYieldOnCost;
  const requiredGrossRent = requiredNOI / noiMargin / stabilizedOccupancy;
  const requiredRentPerM2Month = requiredGrossRent / leasableM2 / 12;
  return {
    totalDevelopmentCost: tdc, requiredNOI, requiredRentPerM2Month, marketRentPerM2Month,
    cushionPct: marketRentPerM2Month / requiredRentPerM2Month - 1,   // + means market rent exceeds need
    feasible: requiredRentPerM2Month <= marketRentPerM2Month * (1 + 1e-9),   // tolerant at the knife-edge
    breakdown: c,
  };
}

/**
 * BACK-DOOR: start from the market, ask what you can AFFORD to pay for land.
 *   Stabilised NOI      = market rent × leasable m² × 12 × NOI margin
 *   Completion value    = NOI ÷ exit cap
 *   Max total cost      = value ÷ (1 + required margin on cost)
 *   Residual land value = max total cost − non-land cost
 * Land is "cheap" when the ask ≤ residual land value.
 */
export function backDoor({ marketRentPerM2Month, leasableM2, buildableM2, hardCostPerM2, exitCap,
  requiredMarginOnCost = 0.15, noiMargin = 0.75, stabilizedOccupancy = 1, softCostPct = 0.15, financingPct = 0.06, landAsk }) {
  const c = nonLandCost({ buildableM2, hardCostPerM2, softCostPct, financingPct });
  const stabilizedNOI = marketRentPerM2Month * leasableM2 * 12 * noiMargin * stabilizedOccupancy;
  const completionValue = stabilizedNOI / exitCap;
  const maxTotalCost = completionValue / (1 + requiredMarginOnCost);
  const residualLandValue = maxTotalCost - c.nonLand;
  return {
    stabilizedNOI, completionValue, maxTotalCost, residualLandValue, breakdown: c,
    landAsk, landIsCheap: landAsk == null ? null : landAsk <= residualLandValue,
    overpayPct: landAsk == null || residualLandValue <= 0 ? null : landAsk / residualLandValue - 1,
  };
}

/**
 * BACK-DOOR, financed variant — the course's ADC problem (Unit 9, lesson 9-3).
 * Instead of a cap rate, capital is what the DEBT and the EQUITY will each support:
 *   Max annual debt service = NOI ÷ DSCR      →  Loan   = ADS ÷ mortgage constant
 *   Equity supported        = (NOI − ADS) ÷ required cash-on-cash
 *   Residual land           = Loan + Equity − construction cost (ex-land)
 * Course anchor: NOI €92,500 · 8%/15-yr · DSCR 1.25 · CoC 12% · cost €5.5m → residual ≈ −€4.71m.
 */
export function backDoorFinanced({ grossRent, vacancy = 0.05, opex = 0, annualRate, amortYears,
  periodsPerYear = 12, dscr = 1.25, cashOnCash = 0.12, constructionCostExLand, landAsk }) {
  const noi = grossRent * (1 - vacancy) - opex;
  const maxADS = noi / dscr;
  const r = annualRate / periodsPerYear, n = amortYears * periodsPerYear;
  const mortgageConstant = (r * periodsPerYear) / (1 - Math.pow(1 + r, -n));   // annual payment per € of loan
  const loan = maxADS / mortgageConstant;
  const equity = (noi - maxADS) / cashOnCash;
  const totalCapital = loan + equity;
  const residualLandValue = totalCapital - constructionCostExLand;
  return { noi, maxADS, mortgageConstant, loan, equity, totalCapital, residualLandValue,
    feasible: residualLandValue > 0, landAsk,
    landIsCheap: landAsk == null ? null : landAsk <= residualLandValue };
}

/* ---------------------------------------------------------------------------------
 * The J-curve — quarterly projection with an ADC loan
 * ------------------------------------------------------------------------------- */

/**
 * Project a development quarter by quarter.
 * Funding rule: equity pays the land and (1 − LTC) of every construction draw; the
 * construction loan funds LTC of each draw. Interest on the drawn balance is CAPITALISED
 * (rolled into the loan) until stabilisation — the "interest reserve". During lease-up,
 * NOI first services interest; any shortfall is capitalised, any surplus is equity cash.
 * At stabilisation the project is sold (net of selling costs) and the loan repaid.
 *
 * @param {object} p
 * @param {number} p.landCost
 * @param {number} p.buildableM2
 * @param {number} p.hardCostPerM2
 * @param {number} p.leasableM2
 * @param {number} p.marketRentPerM2Month
 * @param {number} p.exitCap
 * @param {number} [p.constructionQuarters=6]
 * @param {number} [p.leaseUpQuarters=4]
 * @param {number} [p.stabilizedOccupancy=0.93]
 * @param {number} [p.noiMargin=0.75]
 * @param {number} [p.softCostPct=0.15]
 * @param {number} [p.ltc=0.6]            loan-to-cost on construction draws (0 = all equity)
 * @param {number} [p.loanRate=0.06]      annual, on the drawn balance
 * @param {number} [p.sellingCosts=0.02]
 * @param {number} [p.holdQuartersAfterStabilization=0]
 * @returns {{
 *   quarters: Array<{q:number, phase:string, draw:number, loanDraw:number, equityOut:number,
 *     interest:number, noi:number, occupancy:number, loanBalance:number, equityCF:number, cumulativeEquity:number}>,
 *   totalDevelopmentCost:number, capitalizedInterest:number, completionValue:number,
 *   profit:number, marginOnCost:number, yieldOnCost:number, developmentSpread:number,
 *   peakEquity:number, unleveredIRR:number|null, equityIRR:number|null, troughQuarter:number
 * }}
 */
export function jCurve({ landCost, buildableM2, hardCostPerM2, leasableM2, marketRentPerM2Month, exitCap,
  constructionQuarters = 6, leaseUpQuarters = 4, stabilizedOccupancy = 0.93, noiMargin = 0.75,
  softCostPct = 0.15, ltc = 0.6, loanRate = 0.06, sellingCosts = 0.02, holdQuartersAfterStabilization = 0 }) {
  const hard = buildableM2 * hardCostPerM2;
  const soft = hard * softCostPct;
  const drawPerQ = (hard + soft) / constructionQuarters;
  const stabilizedNOI = marketRentPerM2Month * leasableM2 * 12 * noiMargin * stabilizedOccupancy;
  const rq = loanRate / PPY;

  const quarters = [];
  const equityFlows = [];
  const projectFlows = [];
  let loan = 0, capInt = 0, cum = 0, peak = 0, troughQ = 0;

  // q0 — land (equity)
  equityFlows.push(-landCost); projectFlows.push(-landCost); cum -= landCost; peak = Math.max(peak, -cum);
  quarters.push({ q: 0, phase: "land", draw: landCost, loanDraw: 0, equityOut: landCost, interest: 0,
    noi: 0, occupancy: 0, loanBalance: 0, equityCF: -landCost, cumulativeEquity: cum });
  troughQ = 0;

  let q = 0;
  // construction
  for (let k = 1; k <= constructionQuarters; k++) {
    q++;
    const interest = loan * rq; loan += interest; capInt += interest;          // capitalise
    const loanDraw = drawPerQ * ltc; loan += loanDraw;
    const equityOut = drawPerQ * (1 - ltc);
    equityFlows.push(-equityOut); projectFlows.push(-drawPerQ); cum -= equityOut;
    if (-cum > peak) { peak = -cum; troughQ = q; }
    quarters.push({ q, phase: "construction", draw: drawPerQ, loanDraw, equityOut, interest, noi: 0,
      occupancy: 0, loanBalance: loan, equityCF: -equityOut, cumulativeEquity: cum });
  }
  // lease-up
  for (let k = 1; k <= leaseUpQuarters; k++) {
    q++;
    const occ = stabilizedOccupancy * (k / leaseUpQuarters);
    const noi = (stabilizedNOI / stabilizedOccupancy) * occ / PPY;
    const interest = loan * rq;
    let equityCF = 0;
    if (noi >= interest) { equityCF = noi - interest; }
    else { loan += interest - noi; capInt += interest - noi; }
    equityFlows.push(equityCF); projectFlows.push(noi); cum += equityCF;
    if (-cum > peak) { peak = -cum; troughQ = q; }
    quarters.push({ q, phase: "lease-up", draw: 0, loanDraw: 0, equityOut: 0, interest, noi, occupancy: occ,
      loanBalance: loan, equityCF, cumulativeEquity: cum });
  }
  // stabilised hold (optional) then exit
  for (let k = 1; k <= holdQuartersAfterStabilization; k++) {
    q++;
    const noi = stabilizedNOI / PPY, interest = loan * rq, equityCF = noi - interest;
    equityFlows.push(equityCF); projectFlows.push(noi); cum += equityCF;
    quarters.push({ q, phase: "stabilised", draw: 0, loanDraw: 0, equityOut: 0, interest, noi,
      occupancy: stabilizedOccupancy, loanBalance: loan, equityCF, cumulativeEquity: cum });
  }
  const completionValue = stabilizedNOI / exitCap;
  const netSale = completionValue * (1 - sellingCosts);
  const equityTerminal = netSale - loan;
  equityFlows[equityFlows.length - 1] += equityTerminal;
  projectFlows[projectFlows.length - 1] += netSale;
  cum += equityTerminal;
  quarters[quarters.length - 1] = { ...quarters[quarters.length - 1], phase: quarters[quarters.length - 1].phase + " + exit",
    equityCF: quarters[quarters.length - 1].equityCF + equityTerminal, cumulativeEquity: cum, loanBalance: 0 };

  const tdc = landCost + hard + soft + capInt;
  const profit = completionValue - tdc;
  const uq = irr(projectFlows), eq = irr(equityFlows);
  return {
    quarters, totalDevelopmentCost: tdc, capitalizedInterest: capInt, completionValue, netSale,
    stabilizedNOI, profit, marginOnCost: profit / tdc, yieldOnCost: stabilizedNOI / tdc,
    developmentSpread: stabilizedNOI / tdc - exitCap, peakEquity: peak, troughQuarter: troughQ,
    unleveredIRR: uq == null ? null : Math.pow(1 + uq, PPY) - 1,
    equityIRR: eq == null ? null : Math.pow(1 + eq, PPY) - 1,
    equityFlows, projectFlows,
  };
}

/* ---------------------------------------------------------------------------------
 * The real option to wait
 * ------------------------------------------------------------------------------- */

/**
 * Land is an option on development. Compare building NOW with WAITING one period while
 * rents move up or down (two-state). Waiting costs carry but preserves the choice to
 * build only if it pays. Positive `optionPremium` ⇒ waiting is worth more than building now.
 *
 * @param {object} p
 * @param {number} p.valueNow            profit from building now (from jCurve or backDoor)
 * @param {number} p.valueIfUp           profit if built after rents rise
 * @param {number} p.valueIfDown         profit if built after rents fall (may be negative)
 * @param {number} [p.pUp=0.5]
 * @param {number} [p.carryCost=0]       cost of holding the land one period (tax, interest)
 * @param {number} [p.discountRate=0.08] annual, applied over one period of `periodYears`
 * @param {number} [p.periodYears=1]
 */
export function optionToWait({ valueNow, valueIfUp, valueIfDown, pUp = 0.5, carryCost = 0,
  discountRate = 0.08, periodYears = 1 }) {
  // when you wait, you only build in the states where it pays — you can abandon (value 0)
  const expectedIfWait = (pUp * Math.max(0, valueIfUp) + (1 - pUp) * Math.max(0, valueIfDown))
    / Math.pow(1 + discountRate, periodYears) - carryCost;
  return {
    buildNow: valueNow, waitValue: expectedIfWait, optionPremium: expectedIfWait - Math.max(0, valueNow),
    recommend: expectedIfWait > Math.max(0, valueNow) ? "WAIT" : "BUILD NOW",
  };
}
