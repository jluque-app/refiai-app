/**
 * game-engine.js — ReFiAI Tycoon orchestrator (Stage 1, headless).
 * Pure ES modules, no dependencies. The visual layer (Astra) calls ONLY:
 *   createGame, advanceQuarter, previewDeal, previewLoan, previewRefi,
 *   buildingVisualState — see ASTRA_BLUEPRINT.md for the contract.
 *
 * Quarter resolution order (fixed): COLLECT → EVENT DRAW → DECISIONS → MARK → REPORT.
 * All loans in-game run at quarterly periodicity (periodsPerYear = 4).
 */
import { irr, amortizationSchedule } from "./finance-core.js";
import { intrinsicValue, proformaCashflows, dscr, sizeLoan, refinanceNPV } from "./deal.js";
import { runWaterfall, makeTerms } from "./waterfall.js";
import { EVENT_DECKS, drawEvent, applyEventEffects, mulberry32 } from "./events.js";
import { EPISODES, evaluateObjectives, NOI_MARGIN } from "./episodes.js";
import { MARKET_DATA } from "./market-data.js";
import { frontDoor, backDoor, jCurve, optionToWait } from "./development.js";

export { EPISODES, MARKET_DATA };

const PPY = 4; // quarterly

/* ================================ create ================================ */

/** Start a new run. State is plain JSON — persist as-is. */
export function createGame({ episodeId, seed = 1, reputation = 50 }) {
  const ep = EPISODES[episodeId];
  if (!ep) throw new Error(`Unknown episode ${episodeId}`);
  const state = {
    episodeId, seed, rngCalls: 0, quarter: 0, cash: ep.startCash, reputation,
    market: { ...ep.market }, activeEvents: [], firedEventIds: [],
    listings: [], assets: [], soldLog: [], equityFlows: [-0],
    fund: ep.lpAllowed ? { lpEquity: 0, gpEquity: 0, terms: null, distributions: [] } : null,
    tranches: [], notes: [], noteListings: [],
    // Season 2 (development): land for sale, land you hold (the option), projects under way.
    rentIndex: 1, landListings: [], landBank: [], projects: [], deliveredLog: [],
    stats: { negativeNPVBuys: 0, soldAboveIntrinsic: 0, defaults: 0,
      covenantBreaches: 0, positiveNPVRefis: 0, promotePaid: 0, navPeak: ep.startCash,
      navTrough: ep.startCash, trancheImpairments: 0, securitizationsAtSeniorDSCR: 0,
      lpIRRUnderRentCap: null, rentCapWasActive: false,
      noteProfits: 0, overparNoteBuys: 0, patternsUsed: [],
      projectsDelivered: 0, marginsOnCost: [], devSpreads: [], landAboveResidualBuys: 0,
      infeasibleStarts: 0, optionsExercised: 0, overrunsPaid: 0 },
    failFlags: [], done: false, log: [],
    // Quarter-by-quarter statements + macro path (feeds the dashboard charts).
    history: [],
  };
  refreshListings(state, ep);
  return state;
}

/** Re-derive the seeded RNG at the current call count (keeps state serializable). */
function rngFor(state) {
  const r = mulberry32(state.seed);
  for (let i = 0; i < state.rngCalls; i++) r();
  return () => { state.rngCalls++; return r(); };
}

let idCounter = 0;
/**
 * Listings are calibrated to REAL district data (market-data.js):
 * price = district €/m² × size; gross rent = district €/m²/month × 12 × size;
 * NOI = gross × NOI_MARGIN. Ask price wanders around intrinsic value (mispricing),
 * and the district's real negotiation margin sets how far below ask a bid can land.
 * Spanish cities: live Fragua data. Others: labeled estimates.
 */
function newListing(state, ep, rng) {
  const districts = MARKET_DATA.cities[ep.cityKey].districts;
  const d = districts[Math.floor(rng() * districts.length)];
  const [sLo, sHi] = ep.sizeRangeM2;
  const sizeM2 = Math.round(sLo + rng() * (sHi - sLo));
  const noiAnnual = d.rentM2Month * 12 * sizeM2 * NOI_MARGIN;
  const trueGrowth = ep.market.rentGrowth + (rng() - 0.5) * 0.02;
  const iv = intrinsicValue({ noiAnnual, growthAnnual: trueGrowth, holdQuarters: 20,
    exitCap: ep.market.capRates[d.postalCode], r: ep.market.discountRate });
  const [mLo, mHi] = ep.mispricing;
  const ask = iv * (mLo + rng() * (mHi - mLo));
  return { id: `${ep.city.toLowerCase().slice(0, 3)}-${String(++idCounter).padStart(3, "0")}`,
    type: d.postalCode, district: d.district, sizeM2, priceM2: round2(ask / sizeM2),
    negotiationMargin: d.negotiationMargin ?? 0.05,
    askPrice: round2(ask), noiAnnual: round2(noiAnnual), trueGrowth, listedQ: state.quarter };
}

function refreshListings(state, ep) {
  const rng = rngFor(state);
  const [lo, hi] = ep.listingsPerQuarter;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  state.listings = Array.from({ length: n }, () => newListing(state, ep, rng));
  if (ep.noteDeskAllowed) refreshNoteListings(state, ep, rng);
  if (ep.developmentAllowed) refreshLandListings(state, ep, rng);
}

/* ============================ development (S2) ============================ */

/** Effective ADC (construction-loan) rate: floating, base + construction spread. */
function adcRate(ep, m) { return m.baseRate + (ep.development?.constructionSpread ?? 0.025); }

/** Market rent for a district today: Fragua/estimate rent × the run's rent index. */
function districtRent(state, ep, postalCode) {
  const d = MARKET_DATA.cities[ep.cityKey].districts.find((x) => x.postalCode === postalCode);
  return d.rentM2Month * state.rentIndex;
}

/** Common inputs for the feasibility functions, at TODAY's market (events folded in). */
function devInputs(state, ep, land, m, { includeContractorSqueeze = true } = {}) {
  const dev = ep.development;
  const exitCap = ep.market.capRates[land.type] + (m.capRateShift || 0);
  const rate = adcRate(ep, m);
  const base = {
    buildableM2: land.buildableM2, leasableM2: land.leasableM2,
    hardCostPerM2: land.hardCostPerM2 * (includeContractorSqueeze ? m.hardCostFactor : 1),
    marketRentPerM2Month: districtRent(state, ep, land.type) * m.projectNoiFactor,
    exitCap, noiMargin: NOI_MARGIN, softCostPct: dev.softCostPct,
    requiredMarginOnCost: dev.requiredMarginOnCost,
    targetYieldOnCost: exitCap * (1 + dev.requiredMarginOnCost),
    constructionQuarters: dev.constructionQuarters, leaseUpQuarters: dev.leaseUpQuarters,
    stabilizedOccupancy: dev.stabilizedOccupancy, loanRate: rate,
  };
  // The static doors need a financing-cost figure. Rather than a rule of thumb, take the
  // capitalised interest the J-curve itself would roll up at the maximum LTC (it does not
  // depend on the land price), so front door, back door and J-curve agree to the euro.
  const probe = jCurve({ ...base, landCost: 0, ltc: dev.maxLTC });
  const hardSoft = base.buildableM2 * base.hardCostPerM2 * (1 + dev.softCostPct);
  return { ...base, financingPct: hardSoft > 0 ? probe.capitalizedInterest / hardSoft : 0 };
}

/**
 * Land plots calibrated to the district data: buildable area × district hard cost; the ask
 * wanders around the RESIDUAL land value (back-door) by `landMispricing`, so some plots are
 * bargains and some are traps — exactly the screen the course asks students to run.
 */
function newLandListing(state, ep, rng) {
  const dev = ep.development;
  const districts = MARKET_DATA.cities[ep.cityKey].districts;
  const d = districts[Math.floor(rng() * districts.length)];
  const [bLo, bHi] = dev.buildableRangeM2;
  const buildableM2 = Math.round((bLo + rng() * (bHi - bLo)) / 50) * 50;
  const land = { id: `land-${String(++idCounter).padStart(3, "0")}`, kind: "land", type: d.postalCode,
    district: d.district, buildableM2, leasableM2: Math.round(buildableM2 * dev.efficiency),
    hardCostPerM2: dev.hardCostPerM2[d.postalCode] ?? 3_000,
    negotiationMargin: d.negotiationMargin ?? 0.05, listedQ: state.quarter };
  const m = applyEventEffects(state.market, state.activeEvents);
  const bd = backDoor(devInputs(state, ep, land, m, { includeContractorSqueeze: false }));
  const [mLo, mHi] = dev.landMispricing;
  land.residualLandValue = round2(bd.residualLandValue);
  land.askPrice = round2(Math.max(50_000, bd.residualLandValue) * (mLo + rng() * (mHi - mLo)));
  land.pricePerBuildableM2 = round2(land.askPrice / buildableM2);
  return land;
}

function refreshLandListings(state, ep, rng) {
  const [lo, hi] = ep.development.landsPerQuarter;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  state.landListings = Array.from({ length: n }, () => newLandListing(state, ep, rng));
}

/**
 * The Development Desk preview — pure. Runs BOTH doors and the J-curve for a plot at a
 * hypothetical land price and loan-to-cost. Works for plots on the market and plots you hold.
 */
export function previewDevelopment(state, landId, { offerPrice, ltc, holdQuartersAfterStabilization = 0 } = {}) {
  const ep = EPISODES[state.episodeId];
  if (!ep.developmentAllowed) return null;
  const land = state.landListings.find((l) => l.id === landId) || state.landBank.find((l) => l.id === landId);
  if (!land) return null;
  const m = applyEventEffects(state.market, state.activeEvents);
  const dev = ep.development;
  const landCost = offerPrice ?? land.purchasePrice ?? land.askPrice;
  const useLTC = Math.min(ltc ?? dev.maxLTC, dev.maxLTC);
  const inp = devInputs(state, ep, land, m);
  const fd = frontDoor({ ...inp, landCost });
  const bd = backDoor({ ...inp, landAsk: landCost });
  const jc = jCurve({ ...inp, landCost, ltc: useLTC, holdQuartersAfterStabilization });
  // Option to wait: one year of carry vs a ±8% rent move (two-state), built only if it pays.
  const up = jCurve({ ...inp, landCost, ltc: useLTC, marketRentPerM2Month: inp.marketRentPerM2Month * 1.08 });
  const down = jCurve({ ...inp, landCost, ltc: useLTC, marketRentPerM2Month: inp.marketRentPerM2Month * 0.92 });
  const wait = optionToWait({ valueNow: jc.profit, valueIfUp: up.profit, valueIfDown: down.profit,
    pUp: 0.5, carryCost: landCost * dev.landCarryAnnual, discountRate: ep.market.discountRate, periodYears: 1 });
  return {
    landId, landCost, ltc: useLTC, adcRate: inp.loanRate, exitCap: inp.exitCap,
    marketRentPerM2Month: round2(inp.marketRentPerM2Month), hardCostPerM2: round2(inp.hardCostPerM2),
    frontDoor: fd, backDoor: bd, jCurve: jc, wait,
    verdict: !fd.feasible ? "INFEASIBLE — required rent above market"
      : landCost > bd.residualLandValue ? "OVERPAYING FOR LAND"
      : jc.developmentSpread >= dev.targetSpreadBps / 10000 ? "GO — spread clears target"
      : "THIN — feasible, but spread below target",
  };
}

/** Mortgage notes offered on the secondary market (E5+): CPM paper at varied coupons. */
function refreshNoteListings(state, ep, rng) {
  const [lo, hi] = ep.notesPerQuarter || [1, 2];
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  const [aLo, aHi] = ep.noteAskRange || [0.9, 1.05];
  state.noteListings = Array.from({ length: n }, () => {
    const principal = 250_000 + Math.round(rng() * 1_750_000);
    const coupon = ep.market.baseRate + 0.005 + rng() * 0.035; // legacy coupons around today's rates
    const amortYears = 20 + Math.round(rng() * 10);
    const paid = Math.round(rng() * 20);
    const sched = amortizationSchedule({ principal, annualRate: coupon, amortYears, periodsPerYear: PPY });
    const balance = paid > 0 ? sched.rows[paid - 1].balance : principal;
    return { id: `note-${String(++idCounter).padStart(3, "0")}`, principal, coupon, amortYears,
      paid, balance: round2(balance), askPrice: round2(balance * (aLo + rng() * (aHi - aLo))),
      rows: sched.rows };
  });
}

/** Fair value of a note = PV of its remaining payments at today's note yield. Pure. */
export function previewNote(state, noteId) {
  const note = state.noteListings.find((x) => x.id === noteId) || state.notes.find((x) => x.id === noteId);
  if (!note) return null;
  const ep = EPISODES[state.episodeId];
  const m = applyEventEffects(state.market, state.activeEvents);
  const yieldAnnual = m.baseRate + (ep.market.noteYieldSpread || 0.015) + (m.noteSpread || 0);
  const rq = yieldAnnual / PPY;
  let fair = 0;
  const remaining = note.rows.slice(note.paid);
  remaining.forEach((row, i) => { fair += row.payment / Math.pow(1 + rq, i + 1); });
  const last = remaining[remaining.length - 1];
  if (last) fair += last.balance / Math.pow(1 + rq, remaining.length);
  return { noteId, balance: note.balance, coupon: note.coupon, yieldAnnual,
    fairValue: round2(fair), askPrice: note.askPrice,
    verdict: fair >= note.askPrice ? "DISCOUNT — BUY" : "OVER FAIR VALUE" };
}

/* =============================== previews =============================== */

/** Pure underwriting preview for a listing at a hypothetical offer price. */
export function previewDeal(state, dealId, { offerPrice, holdQuarters = 20, exitCapShift = 0 } = {}) {
  const ep = EPISODES[state.episodeId];
  const deal = state.listings.find((l) => l.id === dealId);
  if (!deal) return null;
  const m = applyEventEffects(state.market, state.activeEvents);
  const exitCap = ep.market.capRates[deal.type] + (m.capRateShift || 0) + exitCapShift;
  const price = offerPrice ?? deal.askPrice;
  const iv = intrinsicValue({ noiAnnual: deal.noiAnnual, growthAnnual: deal.trueGrowth,
    holdQuarters, exitCap, r: ep.market.discountRate });
  const { cfs } = proformaCashflows({ noiAnnual: deal.noiAnnual, growthAnnual: deal.trueGrowth,
    holdQuarters, exitCap });
  const q = irr([-price, ...cfs]);
  return { dealId, price, intrinsicValue: round2(iv), npv: round2(iv - price),
    irr: q == null ? null : Math.pow(1 + q, PPY) - 1,
    capRateAtPrice: deal.noiAnnual / price, verdict: iv - price >= 0 ? "CHEAP" : "RICH" };
}

/** Loan preview at the player's chosen LTV/pattern. Rate = base + spread − reputation bonus. */
export function previewLoan(state, { value, noiAnnual, ltv = 0.7, amortYears = 25, pattern = "CPM",
  termQuarters = 28 }) {
  const ep = EPISODES[state.episodeId];
  if (!ep.debtAllowed) return null;
  // Curriculum gating: e.g. Madrid (Day 2) only knows the CPM — IO/CAM/ARM unlock in Miami (Day 8).
  if (ep.allowedPatterns && !ep.allowedPatterns.includes(pattern)) {
    return { rejected: true, reason: `Pattern ${pattern} not yet unlocked in this episode`,
      allowedPatterns: ep.allowedPatterns };
  }
  const m = applyEventEffects(state.market, state.activeEvents);
  const repBonus = Math.floor(state.reputation / 10) * 0.0005; // 5 bps per 10 rep
  const rate = m.baseRate + m.refiSpread - repBonus; // m.refiSpread = base spread + any event add-on
  const sized = sizeLoan({ value, noiAnnual, annualRate: rate, amortYears, periodsPerYear: PPY,
    maxLTV: Math.min(ltv, ep.market.maxLTV), minDSCR: ep.market.minDSCR });
  const proceeds = sized.proceeds;
  const sched = amortizationSchedule({ principal: proceeds, annualRate: rate, amortYears,
    periodsPerYear: PPY, pattern, termPeriods: termQuarters });
  const ds1y = sched.rows.slice(0, PPY).reduce((s, r) => s + r.payment, 0);
  // Origination points (Day-2 Madrid topic): paid up front, waived during a lender promo event.
  const pointsCost = m.waivePoints ? 0 : round2(proceeds * (ep.loanPoints || 0));
  return { proceeds: round2(proceeds), constraint: sized.constraint, rate, pattern, amortYears,
    termQuarters, schedule: sched.rows, balloon: round2(sched.balloon),
    dscrYear1: dscr(noiAnnual, ds1y), pointsCost, prepayPenalty: ep.prepayPenalty || 0 };
}

/** Refi preview for an owned asset at current market rates. */
export function previewRefi(state, assetId, { refiCosts = 0.01 } = {}) {
  const a = state.assets.find((x) => x.id === assetId);
  if (!a || !a.loan) return null;
  const m = applyEventEffects(state.market, state.activeEvents);
  const ep = EPISODES[state.episodeId];
  const newRate = m.baseRate + m.refiSpread;
  // Prepayment penalty (Day-2 topic) enters the payoff, exactly as in the course's refi rule.
  const npvValue = refinanceNPV({ oldSchedule: { rows: a.loan.rows }, fromPeriod: a.loan.paid,
    newAnnualRate: newRate, periodsPerYear: PPY, payoffPenalty: ep.prepayPenalty || 0,
    refiCosts: a.loan.balance * refiCosts });
  return { assetId, newRate, npv: round2(npvValue), prepayPenalty: ep.prepayPenalty || 0,
    verdict: npvValue > 0 ? "REFINANCE" : "KEEP" };
}

/* ============================ quarter advance ============================ */

/**
 * The only mutation path.
 * @param {object} decisions { bids:[{dealId, price, loan:{ltv,pattern,amortYears,termQuarters}}],
 *   sells:[assetId], refis:[assetId], raiseLP:{amount, prefRate, tiers}, pass }
 * @returns {{state, events:[], triggers:[], report}}
 */
export function advanceQuarter(state, decisions = {}) {
  if (state.done) return { state, events: [], triggers: [], report: lastReport(state) };
  const ep = EPISODES[state.episodeId];
  const triggers = [];
  const events = [];
  state.quarter += 1;
  let devCashQ = 0;   // Season 2: net cash to/from the development book this quarter (the J-curve line)

  /* -- 1. COLLECT: NOI accrues, debt service pays -- */
  const m0 = applyEventEffects(state.market, state.activeEvents);
  let noiQ = 0, debtServiceQ = 0;
  for (const a of state.assets) {
    const gq = Math.pow(1 + effGrowth(a, m0), 1 / PPY) - 1;
    a.noiAnnual *= 1 + gq;
    const cashNOI = (a.noiAnnual / PPY) * m0.noiFactor * Math.max(0, Math.min(1, a.occupancy + m0.occupancyDelta));
    noiQ += cashNOI;
    if (a.developed) devCashQ += cashNOI;
    if (a.loan) {
      const row = a.loan.rows[a.loan.paid];
      if (row) { debtServiceQ += row.payment; a.loan.balance = row.balance; a.loan.paid += 1; if (a.developed) devCashQ -= row.payment; }
      // balloon due?
      if (a.loan.paid >= a.loan.termQuarters && a.loan.balance > 1) {
        if (state.cash + 0 >= a.loan.balance) { state.cash -= a.loan.balance; a.loan = null;
          triggers.push(trigger("BALLOON_PAID", "Balloon repaid", "You repaid a balloon in cash. Refinancing earlier is usually cheaper.", ep.lessonLinks.refi || null));
        } else { state.failFlags.push("missedBalloon"); }
      }
    }
  }
  // Owned mortgage notes (E5+) pay their quarterly installment.
  let noteIncomeQ = 0;
  for (const note of state.notes) {
    const row = note.rows[note.paid];
    if (row) { noteIncomeQ += row.payment; note.balance = row.balance; note.paid += 1; }
    if (note.paid >= note.rows.length || note.balance <= 1) note.matured = true;
  }
  state.stats.noteProfits += noteIncomeQ;
  state.notes = state.notes.filter((n) => !n.matured);
  state.cash += noiQ + noteIncomeQ - debtServiceQ;

  /* -- covenant tracking -- */
  for (const a of state.assets) {
    if (!a.loan) { a.covenantStrikes = 0; continue; }
    const ds1y = a.loan.rows.slice(a.loan.paid, a.loan.paid + PPY).reduce((s, r) => s + (r?.payment || 0), 0);
    a.dscr = dscr(a.noiAnnual * m0.noiFactor, ds1y || 1);
    if (a.dscr < (ep.market.covenantDSCR || 0)) {
      a.covenantStrikes = (a.covenantStrikes || 0) + 1;
      state.stats.covenantBreaches += 1;
      if (a.covenantStrikes === 1) triggers.push(trigger("COVENANT_WARNING", "Covenant warning",
        `DSCR ${a.dscr.toFixed(2)} < ${ep.market.covenantDSCR}. One more quarter below the line is a technical default.`,
        ep.lessonLinks.mortgages || null));
      if (a.covenantStrikes >= 2) {
        // technical default: lender seizes at recovery
        state.stats.defaults += 1;
        state.cash += Math.max(0, a.value * ep.market.defaultRecovery - a.loan.balance);
        a.seized = true;
        state.failFlags.push("technicalDefault");
      }
    } else a.covenantStrikes = 0;
  }
  state.assets = state.assets.filter((a) => !a.seized);

  /* -- 2. EVENT DRAW -- */
  state.activeEvents = state.activeEvents
    .map((e) => ({ ...e, remaining: e.remaining - 1 }))
    .filter((e) => e.remaining > 0);
  const rng = rngFor(state);
  let drawn = drawEvent(EVENT_DECKS[state.episodeId], rng, state.firedEventIds);
  if (drawn?.requires === "construction" && !state.projects.some((p) => p.phase === "construction")) drawn = null;
  if (drawn) {
    state.activeEvents.push({ event: drawn, remaining: drawn.durationQ });
    state.firedEventIds.push(drawn.id);
    events.push({ id: drawn.id, name: drawn.name, severity: drawn.severity, text: drawn.text });
    if (drawn.effects?.capexShock && state.assets.length) {
      const victim = state.assets[Math.floor(rng() * state.assets.length)];
      const hit = victim.value * drawn.effects.capexShock;
      state.cash -= hit; events[events.length - 1].assetId = victim.id;
    }
    if (drawn.id === "RENT_CAP") state.stats.rentCapWasActive = true;
  }
  const m = applyEventEffects(state.market, state.activeEvents);

  // Prepayment wave (E5): borrowers refinance — your notes repay early AT PAR.
  // Premium paper loses its premium; the reinvestment-risk lesson, played.
  if (m.prepayWave && state.notes.length) {
    for (const note of state.notes) {
      state.cash += note.balance;
      state.stats.noteProfits += note.balance;
    }
    triggers.push(trigger("PREPAY_WAVE", "Paid off at par",
      "Your notes prepaid at par. Any premium you paid above balance is gone — prepayment risk in one line.",
      ep.lessonLinks.secondary || null));
    state.notes = [];
  }

  /* -- 2b. DEVELOPMENT (S2): rents index, land carries, projects draw / lease up / deliver -- */
  let devEquityQ = 0, devNoiQ = 0;
  if (ep.developmentAllowed) {
    state.rentIndex *= Math.pow(1 + m.rentGrowth, 1 / PPY);
    // land bank: carry cost + re-mark at today's residual (land is a levered claim on rents)
    for (const land of state.landBank) {
      const carry = land.purchasePrice * ep.development.landCarryAnnual / PPY;
      state.cash -= carry; devEquityQ += carry; devCashQ -= carry; land.heldQ = (land.heldQ || 0) + 1;
      land.residualLandValue = round2(backDoor(devInputs(state, ep, land, m, { includeContractorSqueeze: false })).residualLandValue);
    }
    // cost overrun hits one random site under construction — equity pays, the bank does not
    if (m.costOverrun && state.projects.some((p) => p.phase === "construction")) {
      const sites = state.projects.filter((p) => p.phase === "construction");
      const victim = sites[Math.floor(rng() * sites.length)];
      const hit = victim.budgetRemaining * m.costOverrun;
      state.cash -= hit; victim.tdc += hit; victim.equityIn += hit; victim.overruns += hit;
      devEquityQ += hit; devCashQ -= hit; state.stats.overrunsPaid += hit;
      if (events.length) events[events.length - 1].projectId = victim.id;
    }
    const rq = adcRate(ep, m) / PPY;
    for (const p of state.projects) {
      p.rate = adcRate(ep, m);
      if (p.phase === "construction") {
        const interest = p.loanBalance * rq; p.loanBalance += interest; p.capInt += interest; p.tdc += interest;
        if (m.permitDelay) { p.delayedQ += 1; continue; }              // no progress, interest still rolls
        const draw = Math.min(p.drawPerQ, p.budgetRemaining);
        const loanDraw = draw * p.ltc, equityOut = draw - loanDraw;
        if (state.cash < equityOut) { state.failFlags.push("stalledProject"); p.phase = "stalled"; continue; }
        state.cash -= equityOut; devEquityQ += equityOut; devCashQ -= equityOut;
        p.loanBalance += loanDraw; p.equityIn += equityOut; p.budgetRemaining -= draw; p.progressQ += 1;
        if (p.progressQ >= p.constructionQuarters && p.budgetRemaining <= 1) { p.phase = "lease-up"; p.leaseQ = 0; }
      } else if (p.phase === "lease-up") {
        p.leaseQ += 1;
        p.occupancy = p.stabilizedOccupancy * Math.min(1, p.leaseQ / p.leaseUpQuarters);
        const noiQp = (p.stabilizedNOI / PPY) * (p.occupancy / p.stabilizedOccupancy) * m.noiFactor;
        const interest = p.loanBalance * rq;
        devNoiQ += noiQp;
        if (noiQp >= interest) { state.cash += noiQp - interest; devCashQ += noiQp - interest; }
        else { p.loanBalance += interest - noiQp; p.capInt += interest - noiQp; p.tdc += interest - noiQp; }
        if (p.leaseQ >= p.leaseUpQuarters) devCashQ += deliverProject(state, ep, p, m, triggers);
      }
    }
    state.projects = state.projects.filter((p) => p.phase !== "delivered");
  }

  /* -- 3. DECISIONS -- */
  // sells
  for (const assetId of decisions.sells || []) {
    const a = state.assets.find((x) => x.id === assetId);
    if (!a) continue;
    const proceeds = a.value * (1 - 0.02) - (a.loan ? a.loan.balance : 0);
    state.cash += proceeds;
    if (a.developed) devCashQ += proceeds;
    const iv = intrinsicValue({ noiAnnual: a.noiAnnual, growthAnnual: a.growth, holdQuarters: 20,
      exitCap: exitCapFor(ep, a, m), r: ep.market.discountRate });
    if (a.value > iv) state.stats.soldAboveIntrinsic += 1;
    state.soldLog.push({ id: a.id, boughtQ: a.boughtQ, soldQ: state.quarter,
      price: a.purchasePrice, exit: a.value, flows: a.flows.concat(proceeds) });
    state.assets = state.assets.filter((x) => x.id !== assetId);
  }
  // refis
  for (const assetId of decisions.refis || []) {
    const prev = previewRefi(state, assetId);
    const a = state.assets.find((x) => x.id === assetId);
    if (!a || !a.loan || !prev) continue;
    if (m.windowClosed) { triggers.push(trigger("WINDOW_CLOSED", "Credit window closed", "No refinancing while the crunch lasts.", null)); continue; }
    if (prev.npv > 0) state.stats.positiveNPVRefis += 1;
    const lp = previewLoan(state, { value: a.value, noiAnnual: a.noiAnnual, ltv: a.loan.ltv,
      amortYears: a.loan.amortYears, pattern: a.loan.pattern, termQuarters: a.loan.termQuarters });
    if (!lp || lp.rejected) continue;
    // payoff includes the prepayment penalty (Day-2 topic) + 1% refi costs + new-loan points
    state.cash += lp.proceeds - a.loan.balance * (1 + (ep.prepayPenalty || 0)) -
      a.loan.balance * 0.01 - (lp.pointsCost || 0);
    a.loan = ownLoan(lp);
    if (state.quarter && !state.log.includes("FIRST_REFI")) {
      state.log.push("FIRST_REFI");
      triggers.push(trigger("FIRST_REFI", "The refinance rule", "Refinance when the PV of the old payments at today's rate exceeds the payoff plus costs.", ep.lessonLinks.refi || null));
    }
  }
  // LP raise (E3+)
  if (decisions.raiseLP && state.fund && ep.lpAllowed) {
    const { amount, prefRate = ep.market.defaultPref, tiers } = decisions.raiseLP;
    const cap = ep.market.lpPool * (m.extraLP ? 1.25 : 1);
    const take = Math.min(amount, cap - state.fund.lpEquity);
    state.fund.lpEquity += take;
    state.fund.contributionsByQ = state.fund.contributionsByQ || {};
    state.fund.contributionsByQ[state.quarter] = (state.fund.contributionsByQ[state.quarter] || 0) + take;
    state.fund.terms = { prefRate, tiers: tiers || [{ hurdle: 0.12, lpShare: 0.8 }, { hurdle: null, lpShare: 0.6 }] };
    state.cash += take;
    if (!state.log.includes("FIRST_LP")) {
      state.log.push("FIRST_LP");
      triggers.push(trigger("FIRST_LP", "Other people's money", "The pref is a promise, the promote is the prize. Design the waterfall you can honor.", ep.lessonLinks.waterfall || null));
    }
  }
  // note purchases (E5+ secondary market)
  for (const buy of decisions.buyNotes || []) {
    const note = state.noteListings.find((x) => x.id === buy.noteId);
    if (!note || state.cash < note.askPrice) continue;
    const pv = previewNote(state, note.id);
    if (pv && note.askPrice > pv.fairValue) state.stats.overparNoteBuys += 1;
    state.cash -= note.askPrice;
    state.stats.noteProfits -= note.askPrice;
    state.notes.push({ ...note, boughtQ: state.quarter, costBasis: note.askPrice });
    state.noteListings = state.noteListings.filter((x) => x.id !== note.id);
    if (!state.log.includes("FIRST_NOTE")) {
      state.log.push("FIRST_NOTE");
      triggers.push(trigger("FIRST_NOTE", "Pricing paper",
        "A loan is just a cash-flow stream: its value is the PV of remaining payments at today's yield. Premium above par, discount below.",
        ep.lessonLinks.secondary || null));
    }
  }
  // --- Season 2: land purchases, land sales, construction starts ---
  if (ep.developmentAllowed) {
    for (const buy of decisions.buyLand || []) {
      const land = state.landListings.find((l) => l.id === buy.landId);
      if (!land) continue;
      const price = buy.price ?? land.askPrice;
      const floor = land.askPrice * (1 - (land.negotiationMargin ?? 0.05));
      if (price < floor * 0.999 || state.cash < price) continue;
      state.cash -= price; devCashQ -= price;
      const residualNow = backDoor(devInputs(state, ep, land, m, { includeContractorSqueeze: false })).residualLandValue;
      if (price > residualNow) state.stats.landAboveResidualBuys += 1;
      state.landBank.push({ ...land, purchasePrice: price, boughtQ: state.quarter, heldQ: 0,
        residualAtBuy: round2(residualNow), residualLandValue: round2(residualNow) });
      state.landListings = state.landListings.filter((l) => l.id !== land.id);
      if (!state.log.includes("FIRST_LAND")) {
        state.log.push("FIRST_LAND");
        triggers.push(trigger("FIRST_LAND", "Two doors, one answer",
          "Front door: what rent does this cost need? Back door: what can the market's rent afford to pay for land? Buy below the residual — or you've paid the developer's profit to the seller.",
          ep.lessonLinks.feasibility || null));
      }
    }
    for (const landId of decisions.sellLand || []) {
      const land = state.landBank.find((l) => l.id === landId);
      if (!land) continue;
      const proceeds = Math.max(0, land.residualLandValue) * 0.97;
      state.cash += proceeds; devCashQ += proceeds;
      state.soldLog.push({ id: land.id, kind: "land", boughtQ: land.boughtQ, soldQ: state.quarter,
        price: land.purchasePrice, exit: round2(proceeds), flows: [-land.purchasePrice, proceeds] });
      state.landBank = state.landBank.filter((l) => l.id !== landId);
    }
    for (const start of decisions.startBuild || []) {
      const land = state.landBank.find((l) => l.id === start.landId);
      if (!land) continue;
      startProject(state, ep, land, m, start, triggers);
    }
  }

  // bids — the district's REAL negotiation margin decides how far below ask a bid can land
  for (const bid of decisions.bids || []) {
    const deal = state.listings.find((l) => l.id === bid.dealId);
    if (!deal) continue;
    const floor = deal.askPrice * (1 - (deal.negotiationMargin ?? 0.05));
    if (bid.price < floor * 0.999) continue; // seller walks away below their real margin
    let loan = null, equityNeeded = bid.price;
    if (bid.loan && ep.debtAllowed) {
      const lp = previewLoan(state, { value: bid.price, noiAnnual: deal.noiAnnual, ...bid.loan });
      if (!lp || lp.rejected) continue; // pattern not unlocked in this episode
      loan = ownLoan(lp); equityNeeded = bid.price - lp.proceeds + (lp.pointsCost || 0);
      if (!state.stats.patternsUsed.includes(lp.pattern)) state.stats.patternsUsed.push(lp.pattern);
      if (!state.log.includes("FIRST_LOAN")) {
        state.log.push("FIRST_LOAN");
        triggers.push(trigger("FIRST_LOAN", "Four ways to repay", "IO, CPM, CAM or ARM — the pattern changes your balloon and your DSCR path.", ep.lessonLinks.mortgages || null));
      }
    }
    if (state.cash < equityNeeded) continue; // can't afford
    const uw = previewDeal(state, deal.id, { offerPrice: bid.price });
    if (uw.npv < 0) state.stats.negativeNPVBuys += 1;
    state.cash -= equityNeeded;
    state.assets.push({ id: deal.id, type: deal.type, purchasePrice: bid.price, value: bid.price,
      noiAnnual: deal.noiAnnual, growth: deal.trueGrowth, occupancy: 0.95, boughtQ: state.quarter,
      heldQ: 0, loan, flows: [-equityNeeded], covenantStrikes: 0, dscr: loan ? null : Infinity });
    state.listings = state.listings.filter((l) => l.id !== deal.id);
  }

  /* -- 4. MARK: values re-mark; NAV, fund distribution -- */
  for (const a of state.assets) {
    a.heldQ += 1;
    a.value = (a.noiAnnual / exitCapFor(ep, a, m)) * m.valueFactor;
    a.flows.push(0); // placeholder; equity flow tracked at portfolio level
  }
  // Land and projects enter NAV at BOOK (equity in), not at hoped-for completion value —
  // that conservatism is what makes the J-curve visible on the chart.
  const devBook = state.landBank.reduce((s, l) => s + l.purchasePrice, 0)
    + state.projects.reduce((s, p) => s + p.equityIn, 0);
  const nav = state.cash + state.assets.reduce((s, a) => s + a.value - (a.loan ? a.loan.balance : 0), 0)
    + state.notes.reduce((s, n) => s + n.balance, 0) + devBook;
  state.stats.navPeak = Math.max(state.stats.navPeak, nav);
  state.stats.navTrough = Math.min(state.stats.navTrough, nav);
  state.equityFlows.push(noiQ + devNoiQ - debtServiceQ);
  if (state.fund) state.fund.distributions.push(Math.max(0, noiQ + devNoiQ - debtServiceQ));
  if (state.cash < 0) state.failFlags.push("cashBelowZero");
  if ((ep.failStates || []).includes("navBelow40") && nav < 0.4 * state.stats.navPeak) state.failFlags.push("navBelow40");

  /* -- 5. REPORT + episode end -- */
  refreshListings(state, ep);
  const metrics = assembleMetrics(state, ep, nav);
  const objectives = evaluateObjectives(ep, metrics);
  if (state.quarter >= ep.quarters || objectives.failed) {
    state.done = true;
    if (objectives.failed) triggers.push(trigger("EPISODE_FAILED", "Debrief with the Professor",
      "Every bust is a lesson. Review the debrief — or bring this run to live office hours.", "/office-hours"));
  }
  const report = { quarter: state.quarter, noiQ: round2(noiQ), debtServiceQ: round2(debtServiceQ),
    btcfQ: round2(noiQ - debtServiceQ), cash: round2(state.cash), nav: round2(nav),
    // Season 2: equity you are still on the hook for (remaining draws × your share) vs cash.
    devCommitments: round2(state.projects.filter((p) => p.phase === "construction")
      .reduce((s, p) => s + p.budgetRemaining * (1 - p.ltc), 0)),
    objectives, metrics, activeEvents: state.activeEvents.map((e) => ({ id: e.event.id, remaining: e.remaining })) };
  state.lastReport = report;
  // Statements history — income-statement lines + balance + the macro variables that moved them.
  const capVals = Object.values(ep.market.capRates);
  const avgCap = capVals.reduce((s, c) => s + c, 0) / capVals.length + (m.capRateShift || 0);
  state.history.push({
    quarter: state.quarter, noiQ: round2(noiQ), debtServiceQ: round2(debtServiceQ),
    noteIncomeQ: round2(noteIncomeQ), btcfQ: round2(noiQ + noteIncomeQ - debtServiceQ),
    cash: round2(state.cash), nav: round2(nav), debt: round2(state.assets.reduce((s, a) => s + (a.loan ? a.loan.balance : 0), 0)
      + state.projects.reduce((s, p) => s + p.loanBalance, 0)),
    baseRate: m.baseRate, avgCapRate: avgCap, activeEventIds: state.activeEvents.map((e) => e.event.id),
    // Season 2 lines: equity drawn into land/projects this quarter, lease-up NOI, sites active
    devEquityQ: round2(devEquityQ), devNoiQ: round2(devNoiQ), devCashQ: round2(devCashQ),
    devCashCumulative: round2((state.history.at(-1)?.devCashCumulative || 0) + devCashQ),
    projectsActive: state.projects.length, rentIndex: state.rentIndex,
  });
  return { state, events, triggers, report };
}

/* ======================= development helpers (S2) ======================= */

/** Turn a banked plot into a project: lock hard cost (incl. any contractor squeeze), start the draws. */
function startProject(state, ep, land, m, start, triggers) {
  const dev = ep.development;
  const ltc = Math.min(start.ltc ?? dev.maxLTC, dev.maxLTC);
  const inp = devInputs(state, ep, land, m);
  const fd = frontDoor({ ...inp, landCost: land.purchasePrice });
  const bd = backDoor({ ...inp, landAsk: land.purchasePrice });
  if (!fd.feasible) state.stats.infeasibleStarts += 1;
  const hard = land.buildableM2 * inp.hardCostPerM2, soft = hard * dev.softCostPct;
  const stabilizedNOI = inp.marketRentPerM2Month * land.leasableM2 * 12 * NOI_MARGIN * dev.stabilizedOccupancy;
  const project = {
    id: land.id.replace("land-", "proj-"), landId: land.id, type: land.type, district: land.district,
    buildableM2: land.buildableM2, leasableM2: land.leasableM2, hardCostPerM2: inp.hardCostPerM2,
    landCost: land.purchasePrice, hard, soft, budgetRemaining: hard + soft,
    drawPerQ: (hard + soft) / dev.constructionQuarters, constructionQuarters: dev.constructionQuarters,
    leaseUpQuarters: dev.leaseUpQuarters, stabilizedOccupancy: dev.stabilizedOccupancy,
    ltc, rate: inp.loanRate, loanBalance: 0, capInt: 0, overruns: 0, equityIn: land.purchasePrice,
    tdc: land.purchasePrice + hard + soft, stabilizedNOI, occupancy: 0,
    phase: "construction", progressQ: 0, leaseQ: 0, delayedQ: 0, startQ: state.quarter, underConstruction: true,
    feasibleAtStart: fd.feasible, requiredRentAtStart: round2(fd.requiredRentPerM2Month),
    marketRentAtStart: round2(inp.marketRentPerM2Month), residualAtStart: round2(bd.residualLandValue),
  };
  state.projects.push(project);
  state.landBank = state.landBank.filter((l) => l.id !== land.id);
  // Did waiting pay? Held ≥ 2 quarters and the residual rose above what you paid for the option.
  if ((land.heldQ || 0) >= 2 && bd.residualLandValue > land.residualAtBuy * 1.05) {
    state.stats.optionsExercised += 1;
    triggers.push(trigger("OPTION_PAID", "The option to wait",
      `You held this plot ${land.heldQ} quarters and its residual rose from €${Math.round(land.residualAtBuy).toLocaleString()} to €${Math.round(bd.residualLandValue).toLocaleString()}. Land is a call option on the building — you just exercised it in the money.`,
      ep.lessonLinks.options || null));
  }
  if (!state.log.includes("FIRST_BUILD")) {
    state.log.push("FIRST_BUILD");
    triggers.push(trigger("FIRST_BUILD", "Welcome to the J-curve",
      `Six quarters of draws, four of lease-up. The bank funds ${Math.round(ltc * 100)}% of each draw and rolls the interest; your equity goes in first and comes out last. Watch NAV dip before it turns.`,
      ep.lessonLinks.jcurve || null));
  }
}

/** Stabilisation: value the building, take out the ADC loan with a permanent loan, book the margin. */
function deliverProject(state, ep, p, m, triggers) {
  const exitCap = ep.market.capRates[p.type] + (m.capRateShift || 0);
  const value = (p.stabilizedNOI / exitCap) * m.valueFactor;
  const margin = (value - p.tdc) / p.tdc;
  const spread = p.stabilizedNOI / p.tdc - exitCap;
  // permanent ("take-out") loan, sized by the same min(LTV, DSCR) rule as any acquisition loan
  const lp = previewLoan(state, { value, noiAnnual: p.stabilizedNOI, ltv: ep.market.maxLTV,
    amortYears: 25, pattern: "CPM", termQuarters: 40 });
  const takeOut = lp && !lp.rejected ? lp.proceeds : 0;
  const shortfall = p.loanBalance - takeOut;              // > 0 ⇒ equity must top up at take-out
  const netTakeOut = takeOut - p.loanBalance - (lp?.pointsCost || 0);
  state.cash += netTakeOut;
  const loan = lp && !lp.rejected ? ownLoan(lp) : null;
  state.assets.push({ id: p.id, type: p.type, district: p.district, purchasePrice: p.tdc, value,
    noiAnnual: p.stabilizedNOI, growth: m.rentGrowth, occupancy: p.stabilizedOccupancy,
    boughtQ: p.startQ, heldQ: 0, loan, flows: [-p.equityIn], covenantStrikes: 0,
    dscr: loan ? null : Infinity, developed: true, marginOnCost: margin, developmentSpread: spread });
  p.phase = "delivered";
  state.stats.projectsDelivered += 1;
  state.stats.marginsOnCost.push(margin);
  state.stats.devSpreads.push(spread);
  state.deliveredLog.push({ id: p.id, district: p.district, startQ: p.startQ, deliveredQ: state.quarter,
    tdc: round2(p.tdc), capInt: round2(p.capInt), overruns: round2(p.overruns), value: round2(value),
    marginOnCost: margin, developmentSpread: spread, takeOut: round2(takeOut), shortfall: round2(shortfall) });
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  triggers.push(trigger(state.log.includes("FIRST_DELIVERY") ? "DELIVERY" : "FIRST_DELIVERY",
    "Stabilised",
    `${p.district}: value €${Math.round(value).toLocaleString()} on cost €${Math.round(p.tdc).toLocaleString()} — margin ${pct(margin)}, yield-on-cost ${pct(p.stabilizedNOI / p.tdc)} vs exit cap ${pct(exitCap)} (spread ${Math.round(spread * 10000)} bps).${shortfall > 0 ? ` The take-out loan fell €${Math.round(shortfall).toLocaleString()} short of the construction balance — equity paid the gap.` : " The take-out repaid the construction loan with cash to spare."}`,
    ep.lessonLinks.jcurve || null));
  if (!state.log.includes("FIRST_DELIVERY")) state.log.push("FIRST_DELIVERY");
  return netTakeOut;
}

/* ============================ metrics & visual ============================ */

function assembleMetrics(state, ep, nav) {
  // portfolio IRR: equity flows + terminal NAV as hypothetical liquidation
  const flows = [...state.equityFlows];
  flows[0] = -ep.startCash;
  // Outside (LP) money is invested capital too: net it out of the quarter it arrived, so the
  // portfolio IRR is a total-equity IRR rather than a number flattered by other people's cash.
  for (const [q, amt] of Object.entries(state.fund?.contributionsByQ || {})) if (flows[q] != null) flows[q] -= amt;
  const flowsWithTerminal = [...flows, nav - state.cash > 0 ? nav : state.cash];
  const q = irr(flowsWithTerminal);
  const portfolioIRR = q == null ? null : Math.pow(1 + q, PPY) - 1;
  let lpIRR = null, gpMultiple = null, promotePaid = 0, prefShortfall = 0;
  if (state.fund && state.fund.terms && state.fund.lpEquity > 0) {
    const wf = runWaterfall({
      terms: makeTerms({ prefRate: state.fund.terms.prefRate, tiers: state.fund.terms.tiers,
        lpEquity: state.fund.lpEquity, gpEquity: Math.max(1, ep.startCash) }),
      distributions: [...state.fund.distributions.slice(0, -1),
        (state.fund.distributions.at(-1) || 0) + Math.max(0, nav)],
      periodsPerYear: PPY,
    });
    lpIRR = wf.lpIRR; gpMultiple = wf.gpMultiple; promotePaid = wf.promotePaid;
    if (state.done && wf.lpIRR != null && wf.lpIRR < state.fund.terms.prefRate) prefShortfall = 1;
    state.stats.promotePaid = promotePaid;
  }
  return {
    portfolioIRR, fundIRR: portfolioIRR, lpIRR, gpMultiple, promotePaid, prefShortfall,
    lpIRRUnderRentCap: state.stats.rentCapWasActive ? lpIRR : null,
    negativeNPVBuys: state.stats.negativeNPVBuys, soldAboveIntrinsic: state.stats.soldAboveIntrinsic,
    defaults: state.stats.defaults, covenantBreaches: state.stats.covenantBreaches,
    positiveNPVRefis: state.stats.positiveNPVRefis,
    assetsHeld4Q: state.assets.filter((a) => a.heldQ >= 4).length + state.soldLog.filter((s) => s.soldQ - s.boughtQ >= 4).length,
    navTroughPct: state.stats.navPeak ? state.stats.navTrough / state.stats.navPeak : 1,
    securitizationsAtSeniorDSCR: state.stats.securitizationsAtSeniorDSCR,
    trancheImpairments: state.stats.trancheImpairments,
    noteProfits: state.stats.noteProfits + state.notes.reduce((s, n) => s + n.balance, 0),
    overparNoteBuys: state.stats.overparNoteBuys,
    patternsUsed: state.stats.patternsUsed.length,
    // Season 2
    projectsDelivered: state.stats.projectsDelivered,
    avgMarginOnCost: state.stats.marginsOnCost.length
      ? state.stats.marginsOnCost.reduce((s, x) => s + x, 0) / state.stats.marginsOnCost.length : null,
    minDevSpread: state.stats.devSpreads.length ? Math.min(...state.stats.devSpreads) : null,
    landAboveResidualBuys: state.stats.landAboveResidualBuys,
    infeasibleStarts: state.stats.infeasibleStarts,
    optionsExercised: state.stats.optionsExercised,
    projectsActive: state.projects.length, landHeld: state.landBank.length,
    failFlags: state.failFlags,
  };
}

/** The 3D hook — see ASTRA_BLUEPRINT.md §2. */
export function buildingVisualState(asset) {
  if (asset.seized) return "default";
  if (asset.justSold) return "sold";
  if (asset.underConstruction) return "construction";
  if (asset.buffed) return "boom";
  if (asset.loan) {
    if ((asset.covenantStrikes || 0) >= 1) return "warning";
    if (asset.dscr != null && asset.dscr < 1.3) return "watch";
  }
  if ((asset.occupancy ?? 1) < 0.9) return "watch";
  return "healthy";
}

/* ================================ helpers ================================ */
function effGrowth(asset, m) {
  let g = asset.growth + (m.rentGrowth - (m.baseRentGrowth ?? m.rentGrowth));
  if (m.rentGrowthCapZero && asset.type === "resi") g = Math.min(g, 0);
  return g;
}
function exitCapFor(ep, asset, m) {
  return ep.market.capRates[asset.type] + (m.capRateShift || 0);
}
function ownLoan(lp) {
  return { principal: lp.proceeds, balance: lp.proceeds, rate: lp.rate, pattern: lp.pattern,
    amortYears: lp.amortYears, termQuarters: lp.termQuarters, ltv: undefined,
    rows: lp.schedule, paid: 0 };
}
function trigger(id, title, body, lessonUrl) {
  return { id, title, body, lessonUrl, officeHoursUrl: "/office-hours" };
}
function lastReport(state) { return state.lastReport || null; }
const round2 = (x) => Math.round(x * 100) / 100;
