/**
 * deal.js — underwriting, valuation, loan sizing and the refinance decision.
 * Mirrors Units 1 and 3 of the ReFiAI curriculum. Pure functions, no deps.
 */
import { pmt, npv, irr, amortizationSchedule } from "./finance-core.js";

/** Direct capitalization: V = NOI / R. */
export function capRateValue(noi, capRate) {
  return noi / capRate;
}

/** The course identity R = r − g (cap rate = discount rate minus growth). */
export function capRateFromRG(r, g) {
  return r - g;
}

/**
 * Quarterly property-before-tax cash flows for a hold, plus reversion.
 * @param {object} p
 * @param {number} p.noiAnnual      year-1 NOI (annual €)
 * @param {number} p.growthAnnual   NOI growth (annual, decimal)
 * @param {number} p.holdQuarters
 * @param {number} p.exitCap        cap rate applied to the next-quarter annualized NOI at exit
 * @param {number} [p.sellingCosts=0.02]
 * @returns {{cfs:number[], reversion:number}} cfs[k] = end of quarter k+1 (excl. price at t0)
 */
export function proformaCashflows({ noiAnnual, growthAnnual, holdQuarters, exitCap, sellingCosts = 0.02 }) {
  const gq = Math.pow(1 + growthAnnual, 1 / 4) - 1;
  const cfs = [];
  let noiQ = noiAnnual / 4;
  for (let q = 1; q <= holdQuarters; q++) {
    noiQ *= 1 + gq;
    cfs.push(noiQ);
  }
  const reversion = ((noiQ * (1 + gq)) * 4 / exitCap) * (1 - sellingCosts);
  cfs[cfs.length - 1] += reversion;
  return { cfs, reversion };
}

/** Intrinsic (DCF) value at a quarterly discount rate derived from annual `r`. */
export function intrinsicValue({ noiAnnual, growthAnnual, holdQuarters, exitCap, r }) {
  const rq = Math.pow(1 + r, 1 / 4) - 1;
  const { cfs } = proformaCashflows({ noiAnnual, growthAnnual, holdQuarters, exitCap });
  return npv(rq, [0, ...cfs]);
}

/** Debt service coverage ratio (both figures same periodicity). */
export function dscr(noi, debtService) {
  return debtService <= 0 ? Infinity : noi / debtService;
}

/**
 * Loan sizing — the Unit 3 rule: proceeds = min(LTV loan, DSCR loan).
 * @returns {{proceeds:number, constraint:"LTV"|"DSCR", paymentAnnual:number}}
 */
export function sizeLoan({ value, noiAnnual, annualRate, amortYears, periodsPerYear = 12,
  maxLTV = 0.75, minDSCR = 1.25 }) {
  const r = annualRate / periodsPerYear;
  const n = amortYears * periodsPerYear;
  const ltvLoan = value * maxLTV;
  // DSCR loan: max principal whose payment ≤ NOI/(minDSCR)
  const maxPaymentPer = (noiAnnual / periodsPerYear) / minDSCR;
  const dscrLoan = r === 0 ? maxPaymentPer * n : maxPaymentPer * (1 - Math.pow(1 + r, -n)) / r;
  const proceeds = Math.min(ltvLoan, dscrLoan);
  return {
    proceeds,
    constraint: ltvLoan <= dscrLoan ? "LTV" : "DSCR",
    paymentAnnual: pmt(r, n, proceeds) * periodsPerYear,
  };
}

/**
 * Levered equity cash flows: property CFs minus debt service, minus balloon at exit.
 * `scheduleRows` from amortizationSchedule at the same periodicity as `propertyCfs` (quarterly
 * users should pass periodsPerYear=4 schedules).
 */
export function leveredCashflows({ price, loanProceeds, propertyCfs, scheduleRows }) {
  const cfs = [-(price - loanProceeds)];
  for (let k = 0; k < propertyCfs.length; k++) {
    const row = scheduleRows[k];
    let cf = propertyCfs[k] - (row ? row.payment : 0);
    if (k === propertyCfs.length - 1) cf -= row ? row.balance : 0; // repay balloon at exit
    cfs.push(cf);
  }
  return cfs;
}

/** Levered IRR (annualized from quarterly flows). */
export function leveredIRR(quarterlyCfs) {
  const q = irr(quarterlyCfs);
  return q == null ? null : Math.pow(1 + q, 4) - 1;
}

/**
 * The refinance decision (Unit 3, II.8): NPV of refinancing = PV(old remaining payments at
 * NEW market rate) − payoff amount − refi costs. Positive ⇒ refinance.
 */
export function refinanceNPV({ oldSchedule, fromPeriod, newAnnualRate, periodsPerYear = 12,
  payoffPenalty = 0, refiCosts = 0 }) {
  const remaining = oldSchedule.rows.slice(fromPeriod);
  const rNew = newAnnualRate / periodsPerYear;
  const balance = fromPeriod === 0 ? oldSchedule.rows[0].balance + oldSchedule.rows[0].principal
    : oldSchedule.rows[fromPeriod - 1].balance;
  let pvOld = 0;
  remaining.forEach((row, i) => { pvOld += row.payment / Math.pow(1 + rNew, i + 1); });
  const last = remaining[remaining.length - 1];
  if (last) pvOld += last.balance / Math.pow(1 + rNew, remaining.length);
  return pvOld - balance * (1 + payoffPenalty) - refiCosts;
}
