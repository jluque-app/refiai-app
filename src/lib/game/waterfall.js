/**
 * waterfall.js — LP/GP equity waterfall with preferred return and multi-tier promote.
 * Account-based ("hurdle account") method, as taught in Unit 2: at each distribution,
 * cash fills sequentially — accrued LP pref → LP capital → GP capital → promote tiers.
 * Conserves cash exactly: sum(inflows distributed) === sum(LP + GP receipts).
 */

/**
 * Build a terms object.
 * @param {object} t
 * @param {number} t.prefRate            annual preferred return to LP (e.g. 0.08)
 * @param {Array<{hurdle:number|null, lpShare:number}>} t.tiers
 *        Residual splits after pref+capital: each tier applies until LP's cumulative
 *        annualized IRR reaches `hurdle` (null = final tier, no cap).
 *        Example: [{hurdle:0.12, lpShare:0.8}, {hurdle:0.18, lpShare:0.7}, {hurdle:null, lpShare:0.5}]
 * @param {number} t.lpEquity
 * @param {number} t.gpEquity
 */
export function makeTerms({ prefRate, tiers, lpEquity, gpEquity }) {
  return { prefRate, tiers, lpEquity, gpEquity };
}

/**
 * Run the waterfall over a series of periodic distributions.
 * @param {object} p
 * @param {ReturnType<typeof makeTerms>} p.terms
 * @param {number[]} p.distributions   available cash per period (quarterly)
 * @param {number} [p.periodsPerYear=4]
 * @returns {{lpFlows:number[], gpFlows:number[], perPeriod:Array<object>,
 *            lpIRR:number|null, gpIRR:number|null, lpMultiple:number, gpMultiple:number,
 *            promotePaid:number}}
 */
export function runWaterfall({ terms, distributions, periodsPerYear = 4 }) {
  const { prefRate, tiers, lpEquity, gpEquity } = terms;
  const prefPer = Math.pow(1 + prefRate, 1 / periodsPerYear) - 1;
  const totalEquity = lpEquity + gpEquity;
  const lpFrac = lpEquity / totalEquity;

  let lpCapital = lpEquity;      // unreturned LP capital
  let gpCapital = gpEquity;
  let prefAccrued = 0;           // unpaid LP pref balance (compounds)
  let promotePaid = 0;

  const lpFlows = [-lpEquity];
  const gpFlows = [-gpEquity];
  const perPeriod = [];

  for (let k = 0; k < distributions.length; k++) {
    let cash = distributions[k];
    prefAccrued = prefAccrued * (1 + prefPer) + lpCapital * prefPer;
    const detail = { period: k + 1, pref: 0, lpCapital: 0, gpCapital: 0, residualLP: 0, residualGP: 0 };

    // 1. LP preferred return
    const payPref = Math.min(cash, prefAccrued);
    prefAccrued -= payPref; cash -= payPref; detail.pref = payPref;

    // 2. Return of LP capital
    const payLPCap = Math.min(cash, lpCapital);
    lpCapital -= payLPCap; cash -= payLPCap; detail.lpCapital = payLPCap;

    // 3. Return of GP capital
    const payGPCap = Math.min(cash, gpCapital);
    gpCapital -= payGPCap; cash -= payGPCap; detail.gpCapital = payGPCap;

    // 4. Residual through promote tiers, gated by LP cumulative IRR hurdles
    let residualLP = 0, residualGP = 0;
    for (const tier of tiers) {
      if (cash <= 0) break;
      let tranche = cash;
      if (tier.hurdle != null) {
        // Largest extra LP amount this period that keeps LP IRR ≤ hurdle: solve by bisection.
        const target = Math.pow(1 + tier.hurdle, 1 / periodsPerYear) - 1;
        const testFlows = (extraLP) => {
          const f = lpFlows.slice();
          f.push(detail.pref + detail.lpCapital + residualLP + extraLP);
          return irrOrNull(f, target);
        };
        let lo = 0, hi = tranche;
        if (testFlows(hi) < 0) {
          // even the whole tranche doesn't reach the hurdle → all of it in this tier
        } else {
          for (let i = 0; i < 60; i++) {
            const mid = (lo + hi) / 2;
            if (testFlows(mid) < 0) lo = mid; else hi = mid;
          }
          tranche = lo;
        }
      }
      const lpPart = tranche * tier.lpShare;
      const gpPart = tranche * (1 - tier.lpShare);
      residualLP += lpPart; residualGP += gpPart; cash -= tranche;
      // promote = GP residual share beyond its pro-rata equity share
      promotePaid += Math.max(0, gpPart - tranche * (1 - lpFrac));
      if (tier.hurdle == null) break;
    }
    detail.residualLP = residualLP; detail.residualGP = residualGP;

    lpFlows.push(detail.pref + detail.lpCapital + residualLP);
    gpFlows.push(detail.gpCapital + residualGP);
    perPeriod.push(detail);
  }

  const lpIn = sumNeg(lpFlows), lpOut = sumPos(lpFlows);
  const gpIn = sumNeg(gpFlows), gpOut = sumPos(gpFlows);
  return {
    lpFlows, gpFlows, perPeriod, promotePaid,
    lpIRR: annualize(bisectIRR(lpFlows), periodsPerYear),
    gpIRR: annualize(bisectIRR(gpFlows), periodsPerYear),
    lpMultiple: lpIn === 0 ? 0 : lpOut / lpIn,
    gpMultiple: gpIn === 0 ? 0 : gpOut / gpIn,
  };
}

/* ---------- internal helpers ---------- */
function bisectIRR(cfs, lo = -0.9999, hi = 10) {
  const f = (r) => cfs.reduce((a, c, t) => a + c / Math.pow(1 + r, t), 0);
  let flo = f(lo), fhi = f(hi);
  if (Number.isNaN(flo) || Number.isNaN(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}
/** sign of (IRR(flows) − targetPerPeriod); negative ⇒ still below hurdle. */
function irrOrNull(flows, target) {
  const r = bisectIRR(flows);
  if (r == null) return -1;
  return r - target;
}
const annualize = (r, ppy) => (r == null ? null : Math.pow(1 + r, ppy) - 1);
const sumPos = (a) => a.filter((x) => x > 0).reduce((s, x) => s + x, 0);
const sumNeg = (a) => -a.filter((x) => x < 0).reduce((s, x) => s + x, 0);
