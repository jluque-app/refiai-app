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
    stats: { negativeNPVBuys: 0, soldAboveIntrinsic: 0, defaults: 0,
      covenantBreaches: 0, positiveNPVRefis: 0, promotePaid: 0, navPeak: ep.startCash,
      navTrough: ep.startCash, trancheImpairments: 0, securitizationsAtSeniorDSCR: 0,
      lpIRRUnderRentCap: null, rentCapWasActive: false,
      noteProfits: 0, overparNoteBuys: 0, patternsUsed: [] },
    failFlags: [], done: false, log: [],
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
  const rate = m.baseRate + ep.market.refiSpread + (m.refiSpread || 0) - repBonus;
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
  const newRate = m.baseRate + ep.market.refiSpread + (m.refiSpread || 0);
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

  /* -- 1. COLLECT: NOI accrues, debt service pays -- */
  const m0 = applyEventEffects(state.market, state.activeEvents);
  let noiQ = 0, debtServiceQ = 0;
  for (const a of state.assets) {
    const gq = Math.pow(1 + effGrowth(a, m0), 1 / PPY) - 1;
    a.noiAnnual *= 1 + gq;
    const cashNOI = (a.noiAnnual / PPY) * m0.noiFactor * Math.max(0, Math.min(1, a.occupancy + m0.occupancyDelta));
    noiQ += cashNOI;
    if (a.loan) {
      const row = a.loan.rows[a.loan.paid];
      if (row) { debtServiceQ += row.payment; a.loan.balance = row.balance; a.loan.paid += 1; }
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
  const drawn = drawEvent(EVENT_DECKS[state.episodeId], rng, state.firedEventIds);
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

  /* -- 3. DECISIONS -- */
  // sells
  for (const assetId of decisions.sells || []) {
    const a = state.assets.find((x) => x.id === assetId);
    if (!a) continue;
    const proceeds = a.value * (1 - 0.02) - (a.loan ? a.loan.balance : 0);
    state.cash += proceeds;
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
  const nav = state.cash + state.assets.reduce((s, a) => s + a.value - (a.loan ? a.loan.balance : 0), 0)
    + state.notes.reduce((s, n) => s + n.balance, 0);
  state.stats.navPeak = Math.max(state.stats.navPeak, nav);
  state.stats.navTrough = Math.min(state.stats.navTrough, nav);
  state.equityFlows.push(noiQ - debtServiceQ);
  if (state.fund) state.fund.distributions.push(Math.max(0, noiQ - debtServiceQ));
  if (state.cash < 0) state.failFlags.push("cashBelowZero");
  if (ep.id === "E4_NYC" && nav < 0.4 * state.stats.navPeak) state.failFlags.push("navBelow40");

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
    objectives, metrics, activeEvents: state.activeEvents.map((e) => ({ id: e.event.id, remaining: e.remaining })) };
  state.lastReport = report;
  return { state, events, triggers, report };
}

/* ============================ metrics & visual ============================ */

function assembleMetrics(state, ep, nav) {
  // portfolio IRR: equity flows + terminal NAV as hypothetical liquidation
  const flows = [...state.equityFlows];
  flows[0] = -ep.startCash;
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
