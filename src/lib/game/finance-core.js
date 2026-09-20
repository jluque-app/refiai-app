/**
 * finance-core.js — time-value-of-money primitives for ReFiAI Tycoon.
 * Pure functions, no dependencies. Mirrors the course's finance-math and the
 * CREFI Excel models (II.2–II.8). All rates are decimals (0.07 = 7%).
 */

/** Level payment that amortizes `principal` over `n` periods at `rate` per period. */
export function pmt(rate, n, principal) {
  if (rate === 0) return principal / n;
  return (principal * rate) / (1 - Math.pow(1 + rate, -n));
}

/** Present value of a single cash flow `amount` received after `n` periods. */
export function pv(rate, n, amount) {
  return amount / Math.pow(1 + rate, n);
}

/** Future value of a single amount after `n` periods. */
export function fv(rate, n, amount) {
  return amount * Math.pow(1 + rate, n);
}

/**
 * Net present value. `cashflows[0]` occurs at t=0 (typically negative),
 * `cashflows[k]` at the end of period k.
 */
export function npv(rate, cashflows) {
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

/**
 * Internal rate of return per period, by bisection on [-0.9999, 10].
 * Returns null when no sign change exists (IRR undefined).
 */
export function irr(cashflows, lo = -0.9999, hi = 10) {
  const f = (r) => npv(r, cashflows);
  let flo = f(lo);
  let fhi = f(hi);
  if (Number.isNaN(flo) || Number.isNaN(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (Math.abs(fmid) < 1e-9) return mid;
    if (flo * fmid < 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return (lo + hi) / 2;
}

/**
 * Amortization schedule for the four repayment patterns taught in Unit 3.
 * @param {object} p
 * @param {number} p.principal
 * @param {number} p.annualRate       nominal annual rate (compounded per period)
 * @param {number} p.amortYears       amortization horizon
 * @param {number} [p.periodsPerYear=12]
 * @param {"IO"|"CPM"|"CAM"|"ARM"} [p.pattern="CPM"]
 * @param {number} [p.termPeriods]    loan term; balance at term = balloon. Default: full am.
 * @param {number[]} [p.indexPath]    ARM only: annual index rate per period index (adds to margin)
 * @param {number} [p.margin=0]       ARM only: margin over the index
 * @returns {{rows: Array<{t:number,payment:number,interest:number,principal:number,balance:number}>, balloon:number}}
 */
export function amortizationSchedule({ principal, annualRate, amortYears, periodsPerYear = 12,
  pattern = "CPM", termPeriods, indexPath, margin = 0 }) {
  const nAm = Math.round(amortYears * periodsPerYear);
  const nTerm = termPeriods ?? nAm;
  const rows = [];
  let bal = principal;
  let ratePer = annualRate / periodsPerYear;
  let level = pattern === "CPM" ? pmt(ratePer, nAm, principal) : 0;
  const camPrincipal = principal / nAm; // constant amortization slice

  for (let t = 1; t <= nTerm; t++) {
    if (pattern === "ARM") {
      const annual = (indexPath && indexPath[t - 1] != null ? indexPath[t - 1] : annualRate) + margin;
      ratePer = annual / periodsPerYear;
      // ARM re-amortizes the remaining balance over the remaining horizon each reset
      level = pmt(ratePer, nAm - (t - 1), bal);
    }
    const interest = bal * ratePer;
    let principalPaid;
    if (pattern === "IO") principalPaid = 0;
    else if (pattern === "CAM") principalPaid = camPrincipal;
    else principalPaid = (pattern === "ARM" ? level : level) - interest; // CPM/ARM
    if (principalPaid > bal) principalPaid = bal;
    const payment = interest + principalPaid;
    bal -= principalPaid;
    rows.push({ t, payment, interest, principal: principalPaid, balance: bal });
    if (bal <= 1e-8) break;
  }
  return { rows, balloon: bal };
}

/** Outstanding balance after `afterPeriods` on a CPM loan (closed form). */
export function balloonBalance(principal, annualRate, amortYears, periodsPerYear, afterPeriods) {
  const r = annualRate / periodsPerYear;
  const n = Math.round(amortYears * periodsPerYear);
  const p = pmt(r, n, principal);
  // FV of principal minus FV of payments made
  return principal * Math.pow(1 + r, afterPeriods) - p * ((Math.pow(1 + r, afterPeriods) - 1) / r);
}

/**
 * Lender's effective yield (annualized) on a loan issued with `points` (fraction of
 * principal paid up front by the borrower) and held for `holdPeriods` (balloon repaid then).
 * Mirrors CREFI II.6's yield ladder.
 */
export function effectiveYield({ principal, annualRate, amortYears, periodsPerYear = 12,
  points = 0, holdPeriods }) {
  const { rows } = amortizationSchedule({ principal, annualRate, amortYears, periodsPerYear });
  const n = holdPeriods ?? rows.length;
  const cfs = [-(principal * (1 - points))];
  for (let t = 0; t < n; t++) {
    let cf = rows[t] ? rows[t].payment : 0;
    if (t === n - 1) cf += rows[t] ? rows[t].balance : 0; // balloon at end of hold
    cfs.push(cf);
  }
  const perPeriod = irr(cfs);
  return perPeriod == null ? null : perPeriod * periodsPerYear;
}
