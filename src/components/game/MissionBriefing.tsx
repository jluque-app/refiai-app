"use client";

/**
 * MissionBriefing — the panel that answers "what am I doing here?".
 *
 * Playtest feedback on Seasons 1–2 was that the episodes drop you straight into three desks
 * of numbers with no statement of the situation, the goal, or the next click. This panel is
 * the fix: situation, objectives in full sentences, what's new in this episode, and one
 * concrete first action. Open on first visit, collapsed thereafter, reopenable from the HUD.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Target, Sparkles, HelpCircle, ArrowRight } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const eur = (v: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

/** Per-episode: the situation, what the episode adds, and the first thing to do. */
const BRIEFS: Record<string, { situation: string; whatsNew: string; firstMove: string }> = {
    E0_VALENCIA: {
        situation:
            "You are buying your first flats in Valencia, with real asking prices, rents and yields from the Spanish market. There is no bank in this episode — every euro you spend is your own.",
        whatsNew:
            "The one idea everything else is built on: a building is worth its income divided by the market's required yield, V = NOI ÷ R. The game does that arithmetic for you and tells you whether a listing is CHEAP or RICH. Your job is to believe it.",
        firstMove:
            "Click a listing under “On the market”. Read the verdict and the NPV, then drag the offer slider below the asking price and press Make offer. If everything on screen looks expensive, buy nothing — waiting is a legitimate move.",
    },
    E1_VALENCIA: {
        situation:
            "The same city, a bigger wallet and twelve quarters. Still no debt: this episode is about valuation discipline before leverage is allowed to hide your mistakes.",
        whatsNew:
            "Longer runway and larger flats, so timing the sale starts to matter as much as the purchase. One of your stars now requires selling something for more than it is worth.",
        firstMove:
            "Underwrite two or three listings before you bid on any of them. The district matters: sellers in Gran Vía barely negotiate, Camins al Grau concedes up to 30%.",
    },
    E2_MADRID: {
        situation:
            "Madrid, and the bank will finally take your call. Buildings cost more here, so you will need the bank to buy anything serious.",
        whatsNew:
            "The Debt Desk. You can borrow against a purchase using a constant payment mortgage — the one repayment pattern the course has taught you so far. Watch three numbers: the 2% origination points you pay up front, the prepayment penalty if you leave early, and the DSCR, which is your NOI divided by your debt service. Below 1.20 twice and the lender takes the building.",
        firstMove:
            "Pick a listing, tick “Finance with a loan”, and move the LTV slider. Watch the DSCR reading as you borrow more — that is the number that ends runs.",
    },
    E3_BARCELONA: {
        situation:
            "Barcelona, where the deals are worth five to twelve million and you have one. So you stop being a buyer and become a sponsor: you raise other people's money and run the deal.",
        whatsNew:
            "The LP panel. Raise up to €8m from limited partners, and choose the waterfall — the order in which cash is paid out. They get a preferred return first, then capital back, and only then do you earn your promote. Both sides have to win: one star needs the LP above 12% and your own multiple above 2×.",
        firstMove:
            "Open the LP panel on the right, pick a terms preset and queue a raise, then end the quarter. Spend the money only on deals that were worth doing anyway.",
    },
    E4_MIAMI: {
        situation:
            "Miami: warm, fast, priced for optimism, and exposed. Hurricane insurance and a rate shock are both somewhere in this deck.",
        whatsNew:
            "The full debt menu. Interest-only, constant payment, constant amortisation and adjustable rate are all unlocked, and each one produces a different payment path and a different balloon. One star requires you to use at least three of them, because you cannot learn debt design with a single tool.",
        firstMove:
            "Underwrite one deal and price it under each pattern before choosing. Compare the year-one DSCR and the balloon the pattern leaves behind.",
    },
    E5_NYC: {
        situation:
            "New York, and the loans themselves are now for sale. You run buildings and a book of mortgage paper at the same time.",
        whatsNew:
            "The Note Desk. A mortgage is an asset: its value is the present value of the payments left on it, discounted at today's yield — not at its coupon. Pay above that and you are overpaying, however attractive the coupon looks. Watch for the prepayment wave, which repays notes at par and evaporates any premium you paid.",
        firstMove:
            "Open the Note Desk and compare each note's asking price with its fair value. Buy only at a discount.",
    },
    E6_LONDON: {
        situation:
            "London at fund scale: twenty quarters, institutional money, and investors who can ask for it back.",
        whatsNew:
            "Securitisation. Pool your mortgages and sell claims on the pool in layers — senior first and safest, equity last and riskiest. The rating agency wants pool DSCR at or above 1.50 before it blesses the senior tranche. A credit crunch will close the issuance window exactly when you want it open.",
        firstMove:
            "Build the portfolio first. Five assets held for at least four quarters is the base requirement before securitisation is worth attempting.",
    },
    E7_PARIS: {
        situation:
            "Paris, where nothing you buy exists yet. You have €8m, twenty-four quarters, and a construction lender that funds 65 cents of every euro you spend on the building.",
        whatsNew:
            "The Development Desk. Land is priced off what the finished building will be worth minus what it costs to get there — the residual. Run both doors before you buy: the front door asks what rent the project needs, the back door asks what you can afford to pay for the plot. Then watch the J-curve: your money goes out for years before any comes back, and the bottom of that curve has to fit inside your cash.",
        firstMove:
            "Click “Run feasibility” on a plot. If the front door says infeasible, or the peak equity exceeds your cash, walk away — a draw you cannot fund ends the run.",
    },
};

/** The quarterly loop, identical in every episode. */
function HowToPlay({ ep }: { ep: any }) {
    return (
        <div className="text-sm text-[hsl(var(--muted-foreground))] space-y-2 mt-3">
            <p>
                <strong className="text-[hsl(var(--foreground))]">Each quarter</strong> you queue
                decisions — offers, sales{ep.debtAllowed ? ", refinancings" : ""}
                {ep.developmentAllowed ? ", land purchases and construction starts" : ""} — and then
                press <strong className="text-[hsl(var(--foreground))]">End quarter</strong>. Nothing
                happens until you do. Queued items show a count on the button.
            </p>
            <p>
                Ending a quarter collects three months of rent, pays any debt service, draws one
                event from the city's deck, settles your decisions, and re-values everything you own.
                You then get a report explaining what moved and why.
            </p>
            <p>
                <strong className="text-[hsl(var(--foreground))]">The vocabulary:</strong>{" "}
                <em>NOI</em> is annual rent after running costs. The <em>cap rate</em> is the yield
                the market demands, so value = NOI ÷ cap rate. <em>NPV</em> is what you gain or lose
                at the price you are paying — positive is a bargain. <em>IRR</em> is your annualised
                return.
                {ep.debtAllowed && <> <em>DSCR</em> is NOI ÷ debt service; lenders want it comfortably above 1.2.</>}
            </p>
        </div>
    );
}

export default function MissionBriefing({
    episodeId, ep, objectives, onOpenBriefing, forceOpen, onClose,
}: {
    episodeId: string; ep: any; objectives: string[];
    onOpenBriefing?: () => void; forceOpen?: boolean; onClose?: () => void;
}) {
    const key = `refiai_mission_seen_${episodeId}`;
    const [open, setOpen] = useState(false);
    const [howTo, setHowTo] = useState(false);

    useEffect(() => {
        try { if (!localStorage.getItem(key)) { setOpen(true); setHowTo(true); } } catch { setOpen(true); }
    }, [key]);

    useEffect(() => { if (forceOpen) { setOpen(true); setHowTo(true); } }, [forceOpen]);

    const close = () => {
        setOpen(false);
        try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
        onClose?.();
    };

    const brief = BRIEFS[episodeId];
    if (!brief) return null;

    if (!open) {
        return (
            <button onClick={() => setOpen(true)}
                className="w-full text-left mb-5 px-4 py-2.5 rounded-xl border border-dashed text-sm text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--foreground))] flex items-center gap-2 transition-colors">
                <Target size={15} /> <span className="font-medium">Your mission</span>
                <span className="hidden sm:inline">— what you're doing here and how to play</span>
                <ChevronDown size={15} className="ml-auto" />
            </button>
        );
    }

    return (
        <section className="mb-6 rounded-2xl border-2 border-[hsl(var(--primary))] bg-[hsl(var(--secondary))] p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="font-bold text-lg flex items-center gap-2">
                    <Target size={18} className="text-[hsl(var(--primary))]" /> Your mission
                </h2>
                <button onClick={close}
                    className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center gap-1 shrink-0">
                    Hide <ChevronUp size={15} />
                </button>
            </div>

            <p className="text-base leading-relaxed mb-4">{brief.situation}</p>

            <div className="grid sm:grid-cols-3 gap-3 mb-4 text-sm">
                <Fact label="You start with" value={eur(ep.startCash)} />
                <Fact label="You have" value={`${ep.quarters} quarters (${ep.quarters / 4} years)`} />
                <Fact label="Borrowing" value={ep.debtAllowed ? "Allowed" : "Not in this episode"} />
            </div>

            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Sparkles size={15} className="text-[hsl(var(--primary))]" /> What this episode adds
            </h3>
            <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))] mb-4">{brief.whatsNew}</p>

            <h3 className="font-semibold text-sm mb-2">To earn your three stars</h3>
            <ol className="text-sm space-y-1.5 mb-4 list-none">
                {objectives.map((o, i) => (
                    <li key={i} className="flex gap-2">
                        <span className="text-[hsl(var(--brand-gold))] shrink-0">{"★".repeat(i + 1)}</span>
                        <span>{o}</span>
                    </li>
                ))}
            </ol>

            <div className="rounded-xl bg-[hsl(var(--card))] border p-4 mb-3">
                <h3 className="font-semibold text-sm mb-1.5 flex items-center gap-2">
                    <ArrowRight size={15} className="text-[hsl(var(--primary))]" /> Do this first
                </h3>
                <p className="text-sm leading-relaxed">{brief.firstMove}</p>
            </div>

            <button onClick={() => setHowTo((v) => !v)}
                className="text-sm text-[hsl(var(--primary))] flex items-center gap-1.5 hover:underline">
                <HelpCircle size={15} /> {howTo ? "Hide" : "How a quarter works, and what the words mean"}
            </button>
            {howTo && <HowToPlay ep={ep} />}

            <div className="flex flex-wrap gap-2 mt-4">
                <button onClick={close} className="btn btn-primary text-sm px-5 py-2.5 rounded-full">
                    Got it — let me play
                </button>
                {onOpenBriefing && (
                    <button onClick={onOpenBriefing}
                        className="btn bg-[hsl(var(--card))] border text-sm px-5 py-2.5 rounded-full">
                        Watch the professor's briefing first
                    </button>
                )}
            </div>
        </section>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg bg-[hsl(var(--card))] border px-3 py-2">
            <div className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{label}</div>
            <div className="font-semibold">{value}</div>
        </div>
    );
}

/** HUD button to reopen the mission panel. */
export function MissionButton({ onOpen }: { onOpen: () => void }) {
    return (
        <button onClick={onOpen}
            className="text-sm px-3 py-1.5 rounded-full border flex items-center gap-1.5 hover:border-[hsl(var(--primary))] transition-colors"
            title="What am I doing in this episode?">
            <Target size={14} /> Mission
        </button>
    );
}
