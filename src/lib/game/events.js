/**
 * events.js — seeded RNG + macro event decks per city.
 * An event is data, not code: `effects` are declarative and applied centrally by
 * applyEventEffects, so the deck can be rebalanced without touching game logic.
 */

/** Deterministic PRNG (mulberry32). Same seed ⇒ same run. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Event shape:
 * { id, name, severity: "opportunity"|"warning"|"crisis", weight, durationQ,
 *   once (max once per run), text, effects: { rateBps?, rentGrowthBps?, exitCapBps?,
 *   noiFactor?, valueFactor?, occupancyDelta?, refiSpreadBps?, windowClosed?,
 *   extraLP?, capexShock? } }
 */
export const EVENT_DECKS = {
  E1_VALENCIA: [
    { id: "TOURISM_BOOM", name: "Tourism boom", severity: "opportunity", weight: 3, durationQ: 3, once: false,
      text: "Visitor numbers smash records. Market rent growth +150 bps while it lasts.",
      effects: { rentGrowthBps: 150 } },
    { id: "CAP_COMPRESSION", name: "Cap-rate compression", severity: "opportunity", weight: 2, durationQ: 4, once: true,
      text: "Institutional money discovers Valencia. Exit cap rates −50 bps.",
      effects: { exitCapBps: -50 } },
    { id: "STRUCTURAL_REPAIR", name: "Structural repairs", severity: "warning", weight: 3, durationQ: 1, once: false,
      text: "The technical inspection finds aluminosis. One asset takes a one-off capex hit of 2% of value.",
      effects: { capexShock: 0.02 } },
  ],
  E2_MADRID: [
    { id: "ECB_HIKE", name: "ECB hike", severity: "warning", weight: 3, durationQ: 5, once: true,
      text: "The ECB raises rates 100 bps. New CPM quotes are dearer — and your DSCRs feel it.",
      effects: { rateBps: 100 } },
    { id: "POINTS_PROMO", name: "Lender promotion", severity: "opportunity", weight: 2, durationQ: 2, once: true,
      text: "A bank waives origination points to win market share. Borrow now and skip the 2% up front.",
      effects: { waivePoints: true } },
    { id: "DERRAMA", name: "Community derrama", severity: "warning", weight: 3, durationQ: 1, once: false,
      text: "The owners' association votes a special assessment. One asset takes a one-off 1.5%-of-value hit.",
      effects: { capexShock: 0.015 } },
  ],
  E4_MIAMI: [
    { id: "FED_SHOCK", name: "Fed shock", severity: "crisis", weight: 3, durationQ: 6, once: true,
      text: "The Fed hikes 150 bps. ARMs reprice, DSCRs compress. Refinance, de-lever, or sell?",
      effects: { rateBps: 150 } },
    { id: "INSURANCE_SPIKE", name: "Insurance spike", severity: "warning", weight: 3, durationQ: 4, once: false,
      text: "Hurricane season repricing: premiums ×1.5. NOI −6% while active.",
      effects: { noiFactor: 0.94 } },
    { id: "MIGRATION_WAVE", name: "In-migration wave", severity: "opportunity", weight: 2, durationQ: 2, once: false,
      text: "Another 100k newcomers. Market rents +8% over two quarters.",
      effects: { rentGrowthBps: 400 } },
  ],
  E5_NYC: [
    { id: "RATE_RALLY", name: "Rates rally", severity: "opportunity", weight: 3, durationQ: 4, once: true,
      text: "Yields fall 150 bps. Your fixed-rate notes trade at a premium — and refinancing your own debt turns NPV-positive.",
      effects: { rateBps: -150 } },
    { id: "PREPAY_WAVE", name: "Prepayment wave", severity: "warning", weight: 2, durationQ: 2, once: true,
      text: "Borrowers refinance en masse. Premium notes repay early at par — reinvestment risk bites.",
      effects: { prepayWave: true } },
    { id: "SPREAD_BLOWOUT", name: "Spread blowout", severity: "crisis", weight: 2, durationQ: 3, once: true,
      text: "Note spreads gap 250 bps wider. Paper is cheap — if you have the cash and the nerve.",
      effects: { noteSpreadBps: 250 } },
  ],
  E3_BARCELONA: [
    { id: "RENT_CAP", name: "Rent-cap decree", severity: "crisis", weight: 3, durationQ: 6, once: true,
      text: "A rent-containment decree caps residential rent growth at zero while in force.",
      effects: { rentGrowthCapZero: true } },
    { id: "LICENSE_MORATORIUM", name: "Tourist-license moratorium", severity: "warning", weight: 2, durationQ: 4, once: true,
      text: "Tourist licenses frozen. Affected assets re-mark −10%; conversion plays blocked.",
      effects: { valueFactor: 0.9 } },
    { id: "ANCHOR_LP", name: "Anchor LP doubles down", severity: "opportunity", weight: 2, durationQ: 2, once: true,
      text: "Your anchor LP offers additional equity at unchanged terms — for two quarters only.",
      effects: { extraLP: true } },
  ],
  E6_LONDON: [
    { id: "CREDIT_CRUNCH", name: "Credit crunch", severity: "crisis", weight: 3, durationQ: 4, once: true,
      text: "Spreads gap +250 bps and the securitization window slams shut.",
      effects: { refiSpreadBps: 250, windowClosed: true } },
    { id: "CONVERSION_SUBSIDY", name: "Office-to-resi subsidy", severity: "opportunity", weight: 2, durationQ: 4, once: true,
      text: "The council subsidizes 30% of office-to-residential conversion capex.",
      effects: { conversionSubsidy: 0.3 } },
    { id: "TENANT_BANKRUPTCY", name: "Anchor tenant bankruptcy", severity: "warning", weight: 3, durationQ: 3, once: false,
      text: "Your anchor tenant enters administration. One asset: occupancy −25% until re-leased.",
      effects: { occupancyDelta: -0.25 } },
  ],
  // Season 2 — Paris, development finance. Every card maps to a risk named in Unit 9:
  // construction risk (overrun, contractor squeeze), entitlement risk (permit delay),
  // lease-up/market risk (rate shock, quota) — and the upside that rewards waiting (metro).
  E7_PARIS: [
    { id: "COST_OVERRUN", name: "Cost overrun", severity: "warning", weight: 3, durationQ: 1, once: false, requires: "construction",
      text: "Asbestos in the substructure. One project under construction takes an unbudgeted +8% on remaining hard cost — equity funds it; the bank's LTC does not move.",
      effects: { costOverrun: 0.08 } },
    { id: "PERMIT_DELAY", name: "Permit appeal", severity: "warning", weight: 2, durationQ: 2, once: true, requires: "construction",
      text: "A neighbours' association appeals the permis de construire. Every site under construction pauses two quarters — interest keeps capitalising.",
      effects: { permitDelay: true } },
    { id: "GRAND_PARIS_EXPRESS", name: "Grand Paris Express", severity: "opportunity", weight: 2, durationQ: 8, once: true,
      text: "The new metro line opens ahead of schedule. Rents across the region grow +300 bps a year and exit caps tighten 25 bps. Land you were holding just became a lot more valuable.",
      effects: { rentGrowthBps: 300, exitCapBps: -25 } },
    { id: "SOCIAL_QUOTA", name: "Social-housing quota", severity: "warning", weight: 2, durationQ: 6, once: true,
      text: "New starts must let 25% of units at regulated rents. Projects started while this is in force stabilise at 92% of market NOI.",
      effects: { projectNoiFactor: 0.92 } },
    { id: "RATE_SHOCK", name: "Rate shock", severity: "crisis", weight: 2, durationQ: 5, once: true,
      text: "The ECB hikes 150 bps. Construction interest capitalises faster, take-out loans size smaller, and exit caps drift +50 bps.",
      effects: { rateBps: 150, exitCapBps: 50 } },
    { id: "CONTRACTOR_SQUEEZE", name: "Contractor squeeze", severity: "warning", weight: 2, durationQ: 3, once: false,
      text: "Olympic-legacy backlog: contractors quote +10% on any NEW start. Projects already contracted are unaffected. Sometimes the option to wait is worth exercising.",
      effects: { hardCostFactor: 1.10 } },
  ],
};

/**
 * Draw at most one event this quarter (35% chance of a draw), weighted, honoring `once`.
 * @returns event object or null
 */
export function drawEvent(deck, rng, firedIds) {
  if (rng() > 0.35) return null;
  const eligible = deck.filter((e) => !(e.once && firedIds.includes(e.id)));
  if (!eligible.length) return null;
  const totalW = eligible.reduce((s, e) => s + e.weight, 0);
  let roll = rng() * totalW;
  for (const e of eligible) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return eligible[eligible.length - 1];
}

/**
 * Fold all currently-active events into effective market parameters.
 * @param {object} baseMarket  { baseRate, rentGrowth, capRates, refiSpread }
 * @param {Array<{event:object, remaining:number}>} active
 */
export function applyEventEffects(baseMarket, active) {
  const m = { ...baseMarket, noiFactor: 1, valueFactor: 1, windowClosed: false,
    extraLP: false, conversionSubsidy: 0, occupancyDelta: 0, capexShock: 0, rentGrowthCapZero: false,
    waivePoints: false, prepayWave: false, noteSpread: 0,
    // Season 2 (development)
    costOverrun: 0, permitDelay: false, projectNoiFactor: 1, hardCostFactor: 1 };
  for (const { event } of active) {
    const fx = event.effects || {};
    if (fx.costOverrun) m.costOverrun = fx.costOverrun;
    if (fx.permitDelay) m.permitDelay = true;
    if (fx.projectNoiFactor) m.projectNoiFactor *= fx.projectNoiFactor;
    if (fx.hardCostFactor) m.hardCostFactor *= fx.hardCostFactor;
    if (fx.rateBps) m.baseRate += fx.rateBps / 10000;
    if (fx.rentGrowthBps) m.rentGrowth += fx.rentGrowthBps / 10000;
    if (fx.exitCapBps) m.capRateShift = (m.capRateShift || 0) + fx.exitCapBps / 10000;
    if (fx.refiSpreadBps) m.refiSpread = (m.refiSpread || 0) + fx.refiSpreadBps / 10000;
    if (fx.noiFactor) m.noiFactor *= fx.noiFactor;
    if (fx.valueFactor) m.valueFactor *= fx.valueFactor;
    if (fx.windowClosed) m.windowClosed = true;
    if (fx.extraLP) m.extraLP = true;
    if (fx.conversionSubsidy) m.conversionSubsidy = fx.conversionSubsidy;
    if (fx.occupancyDelta) m.occupancyDelta += fx.occupancyDelta;
    if (fx.capexShock) m.capexShock = fx.capexShock;
    if (fx.rentGrowthCapZero) m.rentGrowthCapZero = true;
    if (fx.waivePoints) m.waivePoints = true;
    if (fx.prepayWave) m.prepayWave = true;
    if (fx.noteSpreadBps) m.noteSpread += fx.noteSpreadBps / 10000;
  }
  if (m.rentGrowthCapZero) m.rentGrowth = Math.min(m.rentGrowth, 0);
  return m;
}
