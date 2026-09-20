/**
 * episodes.js — all tuning data + objective evaluation.
 * v2: episodes now mirror the 2026-27 MRE "Real Estate Finance and Investments"
 * syllabus day-by-day (see GAME_DESIGN.md §2 for the mapping table):
 *   E0 Valencia  ← FREE TIER: Real Estate 101 (Part 1). A 25-minute on-ramp that teaches
 *                  V = NOI/R and "don't overpay", playable without an account.
 *   E1 Valencia  ← Day 1  (Basic Real Estate Investment Model, valuation)
 *   E2 Madrid    ← Day 2  (Reduced-form Constant Payment Mortgage, points & penalties)
 *   E3 Barcelona ← Days 3–7 (Proforma · Capital Structures & Waterfall · RE Private Equity case)
 *                  → in-game MIDTERM boss (Valuation + CPM + Waterfall, like the real midterm)
 *   E4 Miami     ← Day 8  (Mortgage Design: IO, CPM, CAM, ARM)
 *   E5 New York  ← Days 9–10 (Refinancing + Valuation in Secondary Mortgage Markets)
 *                  → in-game FINAL boss (all mortgage debt topics, like the real exam)
 *   E6 London    ← beyond the syllabus (Advanced Topics: portfolio & securitization) — bonus
 *   E7 Paris     ← SEASON 2: Advanced Topics Unit 9 (Real Estate Development Finance):
 *                  J-curve, front-door/back-door feasibility, residual land value, ADC loans,
 *                  the real option to wait. Engine: development.js.
 * District-level prices/rents/yields come from market-data.js (Spanish cities: live
 * Fragua data; others: labeled estimates).
 */
import { MARKET_DATA } from "./market-data.js";

/** Net operating margin applied to gross rent (opex, vacancy allowance). */
export const NOI_MARGIN = 0.7;

/** Derive a per-city cap-rate map from district gross yields: cap ≈ grossYield × NOI_MARGIN. */
function capsFrom(cityKey) {
  const c = MARKET_DATA.cities[cityKey];
  const caps = {};
  for (const d of c.districts) caps[d.postalCode] = Math.round(d.grossYield * NOI_MARGIN * 10000) / 10000;
  return caps;
}

export const EPISODES = {
  /* ------------------------------ FREE TIER ------------------------------ */
  E0_VALENCIA: {
    id: "E0_VALENCIA", city: "Valencia", cityKey: "valencia", title: "The First Viewing",
    freeTier: true, season: 0,
    syllabusDays: "Real Estate 101 · free",
    topics: "What a building is worth: cap rates, V = NOI ÷ R, and the discipline of walking away",
    // Deliberately short and forgiving: eight quarters, small flats, no debt, no way to be
    // wiped out by the deck. The job of this episode is a first "I can do this", not rigour.
    quarters: 8, startCash: 400_000, debtAllowed: false, lpAllowed: false,
    securitizationAllowed: false, noteDeskAllowed: false,
    market: { baseRate: 0.03, refiSpread: 0.02, rentGrowth: 0.025, capRates: capsFrom("valencia"),
      discountRate: 0.08 },
    listingsPerQuarter: [2, 3], sizeRangeM2: [40, 75],
    mispricing: [0.86, 1.16],          // about half the listings are cheap at ask — the lesson needs both kinds
    // A deliberate ladder: finishing up is one star, underwriting is two, finding a real
    // bargain and negotiating for it is three. Bot runs (24 seeds): buy-the-first-thing play
    // lands on one star, buy-only-positive-NPV on two, haggle-to-the-district-floor on three.
    objectives: {
      star1: { metric: "portfolioIRR", op: ">=", value: 0.04 },
      star2: { metric: "negativeNPVBuys", op: "==", value: 0 },
      star3: { metric: "portfolioIRR", op: ">=", value: 0.15 },
    },
    failStates: ["cashBelowZero"],
    lessonLinks: { valuation: "/course/part-1/lesson/lesson-0-1-2",
      system: "/course/part-1/lesson/lesson-0-1-1", pvmath: "/course/part-1/lesson/lesson-0-2-1" },
  },

  E1_VALENCIA: {
    id: "E1_VALENCIA", city: "Valencia", cityKey: "valencia", title: "First Keys",
    syllabusDays: "Day 1", topics: "Valuation, cap rates, the Basic Real Estate Investment Model",
    quarters: 12, startCash: 600_000, debtAllowed: false, lpAllowed: false, securitizationAllowed: false,
    noteDeskAllowed: false,
    market: { baseRate: 0.03, refiSpread: 0.02, rentGrowth: 0.025, capRates: capsFrom("valencia"),
      discountRate: 0.08 },
    listingsPerQuarter: [2, 3], sizeRangeM2: [55, 140], mispricing: [0.85, 1.2],
    objectives: {
      star1: { metric: "portfolioIRR", op: ">=", value: 0.08 },
      star2: { metric: "portfolioIRR", op: ">=", value: 0.10, and: { metric: "soldAboveIntrinsic", op: ">=", value: 1 } },
      star3: { metric: "negativeNPVBuys", op: "==", value: 0 },
    },
    failStates: ["cashBelowZero"],
    lessonLinks: { valuation: "/course/part-2/lesson/lesson-1-2", pvmath: "/course/part-1/lesson/lesson-0-2-1" },
  },

  E2_MADRID: {
    id: "E2_MADRID", city: "Madrid", cityKey: "madrid", title: "The First Mortgage",
    syllabusDays: "Day 2", topics: "Constant Payment Mortgage (reduced form), points and prepayment penalties",
    quarters: 12, startCash: 500_000, debtAllowed: true, lpAllowed: false, securitizationAllowed: false,
    noteDeskAllowed: false,
    allowedPatterns: ["CPM"],                     // the syllabus teaches CPM only at this point
    loanPoints: 0.02, prepayPenalty: 0.02,        // Day-2 topics: points & penalties, priced in
    market: { baseRate: 0.032, refiSpread: 0.018, rentGrowth: 0.025, capRates: capsFrom("madrid"),
      discountRate: 0.085, maxLTV: 0.7, minDSCR: 1.25, covenantDSCR: 1.20, defaultRecovery: 0.85 },
    listingsPerQuarter: [2, 3], sizeRangeM2: [60, 130], mispricing: [0.88, 1.18],
    objectives: {
      star1: { metric: "portfolioIRR", op: ">=", value: 0.12, and: { metric: "defaults", op: "==", value: 0 } },
      star2: { metric: "covenantBreaches", op: "==", value: 0 },
      star3: { metric: "portfolioIRR", op: ">=", value: 0.15, and: { metric: "negativeNPVBuys", op: "==", value: 0 } },
    },
    failStates: ["technicalDefault", "missedBalloon", "cashBelowZero"],
    lessonLinks: { cpm: "/course/part-2/lesson/lesson-3-2", leverage: "/course/part-2/lesson/lesson-2-2" },
  },

  E3_BARCELONA: {
    id: "E3_BARCELONA", city: "Barcelona", cityKey: "barcelona", title: "The Syndicate",
    syllabusDays: "Days 3–7", topics: "Proforma discipline, capital structures, the equity waterfall, RE private equity (case)",
    quarters: 16, startCash: 1_000_000, debtAllowed: true, lpAllowed: true, securitizationAllowed: false,
    noteDeskAllowed: false,
    allowedPatterns: ["CPM"],                     // debt design comes later (E4) — keep CPM here
    examBoss: { name: "The Midterm Deal", covers: "Valuation + CPM debt + Waterfall",
      note: "A large mixed-use deal that must clear all three midterm topics at once." },
    market: { baseRate: 0.035, refiSpread: 0.018, rentGrowth: 0.025, capRates: capsFrom("barcelona"),
      discountRate: 0.09, maxLTV: 0.65, minDSCR: 1.3, covenantDSCR: 1.20, defaultRecovery: 0.85,
      lpPool: 8_000_000, defaultPref: 0.08 },
    listingsPerQuarter: [1, 3], sizeRangeM2: [400, 2500], mispricing: [0.9, 1.15],
    objectives: {
      star1: { metric: "lpIRR", op: ">=", value: 0.12, and: { metric: "gpMultiple", op: ">=", value: 2.0 } },
      star2: { metric: "lpIRRUnderRentCap", op: ">=", value: 0.12 },
      star3: { metric: "promotePaid", op: ">=", value: 1_500_000, and: { metric: "prefShortfall", op: "==", value: 0 } },
    },
    failStates: ["prefUnpaidAtExit", "cashBelowZero"],
    lessonLinks: { waterfall: "/course/part-2/lesson/lesson-2-4", stack: "/course/part-2/lesson/lesson-2-1" },
  },

  E4_MIAMI: {
    id: "E4_MIAMI", city: "Miami", cityKey: "miami", title: "Mortgage Design",
    syllabusDays: "Day 8", topics: "Mortgage design: IO, CPM, CAM, ARM — matching debt to the deal",
    quarters: 16, startCash: 800_000, debtAllowed: true, lpAllowed: false, securitizationAllowed: false,
    noteDeskAllowed: false,
    allowedPatterns: ["IO", "CPM", "CAM", "ARM"], // the full menu unlocks here
    market: { baseRate: 0.045, refiSpread: 0.02, rentGrowth: 0.03, capRates: capsFrom("miami"),
      discountRate: 0.09, maxLTV: 0.75, minDSCR: 1.25, covenantDSCR: 1.20, defaultRecovery: 0.85 },
    listingsPerQuarter: [2, 4], sizeRangeM2: [120, 800], mispricing: [0.88, 1.18],
    objectives: {
      star1: { metric: "portfolioIRR", op: ">=", value: 0.15, and: { metric: "defaults", op: "==", value: 0 } },
      star2: { metric: "patternsUsed", op: ">=", value: 3 },
      star3: { metric: "covenantBreaches", op: "==", value: 0 },
    },
    failStates: ["technicalDefault", "missedBalloon", "cashBelowZero"],
    lessonLinks: { patterns: "/course/part-2/lesson/lesson-3-2", underwriting: "/course/part-2/lesson/lesson-3-5" },
  },

  E5_NYC: {
    id: "E5_NYC", city: "New York", cityKey: "nyc", title: "The Secondary Market",
    syllabusDays: "Days 9–10", topics: "Mortgage refinancing; valuation of loans in secondary mortgage markets",
    quarters: 16, startCash: 1_500_000, debtAllowed: true, lpAllowed: false, securitizationAllowed: false,
    noteDeskAllowed: true,                        // NEW: buy/sell mortgage notes at premium/discount
    allowedPatterns: ["IO", "CPM", "CAM", "ARM"],
    examBoss: { name: "The Final", covers: "IO/CPM/CAM/ARM, prepayment, refinancing, secondary-market valuation, mortgage design",
      note: "Mirror of the Day-12 exam: a distressed note portfolio to price under time pressure." },
    market: { baseRate: 0.05, refiSpread: 0.025, rentGrowth: 0.02, capRates: capsFrom("nyc"),
      discountRate: 0.10, maxLTV: 0.7, minDSCR: 1.25, covenantDSCR: 1.20, defaultRecovery: 0.8,
      noteYieldSpread: 0.015 },
    listingsPerQuarter: [1, 3], sizeRangeM2: [200, 1500], mispricing: [0.85, 1.12],
    notesPerQuarter: [1, 3], noteAskRange: [0.88, 1.06],   // ask as fraction of par
    objectives: {
      star1: { metric: "portfolioIRR", op: ">=", value: 0.12, and: { metric: "positiveNPVRefis", op: ">=", value: 1 } },
      star2: { metric: "noteProfits", op: ">=", value: 200_000 },
      star3: { metric: "overparNoteBuys", op: "==", value: 0 },
    },
    failStates: ["technicalDefault", "missedBalloon", "cashBelowZero"],
    lessonLinks: { refi: "/course/part-2/lesson/lesson-3-4", secondary: "/course/part-2/lesson/lesson-3-3" },
  },

  E6_LONDON: {
    id: "E6_LONDON", city: "London", cityKey: "london", title: "Tower & Tranche",
    syllabusDays: "Beyond the syllabus (Advanced Topics)", topics: "Portfolio & fund management, securitization, the 2008 lesson",
    quarters: 20, startCash: 5_000_000, debtAllowed: true, lpAllowed: true, securitizationAllowed: true,
    noteDeskAllowed: true, allowedPatterns: ["IO", "CPM", "CAM", "ARM"],
    market: { baseRate: 0.045, refiSpread: 0.022, rentGrowth: 0.02, capRates: capsFrom("london"),
      discountRate: 0.10, maxLTV: 0.7, minDSCR: 1.25, covenantDSCR: 1.20, defaultRecovery: 0.8,
      lpPool: 25_000_000, defaultPref: 0.08, seniorMinDSCR: 1.5, noteYieldSpread: 0.015 },
    listingsPerQuarter: [2, 4], sizeRangeM2: [500, 4000], mispricing: [0.8, 1.1],
    notesPerQuarter: [1, 2], noteAskRange: [0.85, 1.05],
    objectives: {
      star1: { metric: "fundIRR", op: ">=", value: 0.12, and: { metric: "assetsHeld4Q", op: ">=", value: 5 } },
      star2: { metric: "securitizationsAtSeniorDSCR", op: ">=", value: 1, and: { metric: "navTroughPct", op: ">=", value: 0.6 } },
      star3: { metric: "fundIRR", op: ">=", value: 0.15, and: { metric: "trancheImpairments", op: "==", value: 0 } },
    },
    failStates: ["navBelow40", "seniorImpairment", "cashBelowZero"],
    lessonLinks: { mbs: "/course/part-3/lesson/lesson-7-1", lesson2008: "/course/part-3/lesson/lesson-7-2" },
  },

  /* ------------------------------ SEASON 2 ------------------------------ */
  E7_PARIS: {
    id: "E7_PARIS", city: "Paris", cityKey: "paris", title: "Grand Projet", season: 2,
    syllabusDays: "Advanced Topics · Unit 9 (Real Estate Development Finance)",
    topics: "The development process and J-curve, front-door vs back-door feasibility, residual land value, ADC construction loans, the option to wait",
    quarters: 24, startCash: 8_000_000, debtAllowed: true, lpAllowed: true, securitizationAllowed: false,
    noteDeskAllowed: false, developmentAllowed: true,
    allowedPatterns: ["IO", "CPM", "CAM", "ARM"],
    examBoss: { name: "The Capstone Site", covers: "Feasibility + J-curve + ADC financing + real options",
      note: "A large Saint-Denis plot beside a future Grand Paris Express station. Build now, or hold the option?" },
    market: { baseRate: 0.03, refiSpread: 0.018, rentGrowth: 0.02, capRates: capsFrom("paris"),
      discountRate: 0.09, maxLTV: 0.65, minDSCR: 1.30, covenantDSCR: 1.20, defaultRecovery: 0.85,
      lpPool: 20_000_000, defaultPref: 0.08 },
    // Development tuning. Hard costs: Île-de-France new-build, 2026 (instructor estimates).
    development: {
      hardCostPerM2: { "75004": 3_450, "92800": 3_150, "93200": 2_850 },  // heritage / high-rise / standard
      efficiency: 0.85,             // leasable ÷ buildable
      softCostPct: 0.15,
      constructionQuarters: 6, leaseUpQuarters: 4, stabilizedOccupancy: 0.93,
      maxLTC: 0.65, constructionSpread: 0.025,   // ADC rate = base + spread (floating)
      requiredMarginOnCost: 0.15,   // European practice: 15–25% profit on cost
      targetSpreadBps: 75,          // yield-on-cost must beat the exit cap by this to earn star 3
      landCarryAnnual: 0.006,       // taxe foncière + holding, on land cost, while banked
      landsPerQuarter: [1, 2], buildableRangeM2: [1_000, 5_000], landMispricing: [0.75, 1.30],
    },
    listingsPerQuarter: [1, 2], sizeRangeM2: [300, 2500], mispricing: [0.97, 1.15], // core Paris is fully priced: build, don't buy
    objectives: {
      // star 1 — deliver: two stabilised buildings at the unit's own benchmark, ≥15% profit on cost
      star1: { metric: "projectsDelivered", op: ">=", value: 2, and: { metric: "avgMarginOnCost", op: ">=", value: 0.15 } },
      // star 2 — discipline: never pay more than the residual for land, never start a front-door-infeasible scheme
      star2: { metric: "landAboveResidualBuys", op: "==", value: 0, and: { metric: "infeasibleStarts", op: "==", value: 0 } },
      // star 3 — spread + return: every delivery beats the exit cap by ≥75 bps and total equity earns ≥10%
      star3: { metric: "minDevSpread", op: ">=", value: 0.0075, and: { metric: "portfolioIRR", op: ">=", value: 0.10 } },
    },
    failStates: ["technicalDefault", "missedBalloon", "cashBelowZero", "stalledProject"],
    lessonLinks: { jcurve: "/course/part-3/lesson/lesson-9-1", feasibility: "/course/part-3/lesson/lesson-9-2",
      options: "/course/part-3/lesson/lesson-9-3", waterfall: "/course/part-2/lesson/lesson-2-4",
      refi: "/course/part-2/lesson/lesson-3-4" },
  },
};

const OPS = { ">=": (a, b) => a >= b, "==": (a, b) => a === b, "<=": (a, b) => a <= b };

function checkRule(rule, metrics) {
  if (!rule) return true;
  const v = metrics[rule.metric];
  if (v == null) return false;
  return OPS[rule.op](v, rule.value) && checkRule(rule.and, metrics);
}

/**
 * Evaluate stars + fail states from a metrics object assembled by game-engine.
 * @returns {{stars:0|1|2|3, star1:boolean, star2:boolean, star3:boolean, failed:string|null}}
 */
export function evaluateObjectives(episode, metrics) {
  const star1 = checkRule(episode.objectives.star1, metrics);
  const star2 = checkRule(episode.objectives.star2, metrics);
  const star3 = checkRule(episode.objectives.star3, metrics);
  const failed = (episode.failStates || []).find((f) => metrics.failFlags?.includes(f)) || null;
  return { stars: failed ? 0 : (star1 ? 1 : 0) + (star2 ? 1 : 0) + (star3 ? 1 : 0), star1, star2, star3, failed };
}
