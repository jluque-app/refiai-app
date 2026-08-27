import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Users, User, Video, CreditCard, Clock, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
    title: "Office Hours — Live sessions with the professor",
    description:
        "Book live 30-minute office hours in real estate finance: small-group tutorials (€30) or one-to-one sessions (€75) with a professor with 20+ years of teaching experience. Study the free course online, then get taught live.",
    alternates: { canonical: "/office-hours" },
};

const GROUP_URL = process.env.NEXT_PUBLIC_BOOKING_URL_GROUP || "";
const INDIVIDUAL_URL = process.env.NEXT_PUBLIC_BOOKING_URL_INDIVIDUAL || "";

function BookButton({ url, label }: { url: string; label: string }) {
    if (url) {
        return (
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full justify-center">
                {label}
            </a>
        );
    }
    return (
        <Link href="/course/part-1" className="btn w-full justify-center bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--border))]">
            Booking opens soon — start the free course
        </Link>
    );
}

export default function OfficeHours() {
    return (
        <div className="pt-28 pb-20">
            <div className="container mx-auto px-4 max-w-5xl">
                <div className="text-center mb-12">
                    <span className="inline-block px-3 py-1 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] text-sm font-medium mb-4">
                        Study online. Get taught live.
                    </span>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Office hours with the professor</h1>
                    <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
                        The course teaches you the models. Office hours are where we look at <em>your</em> questions
                        together — a concept that won&apos;t click, a problem set, a modelling decision, or advice on breaking
                        into real estate. Live on video, 30 focused minutes.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
                    {/* Small group — default offer */}
                    <div className="relative flex flex-col bg-[hsl(var(--card))] border-2 border-[hsl(var(--primary))] rounded-2xl p-8">
                        <span className="absolute -top-3 left-6 px-3 py-0.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-semibold rounded-full">
                            Most popular
                        </span>
                        <div className="flex items-center gap-3 mb-3">
                            <Users size={22} className="text-[hsl(var(--primary))]" />
                            <h2 className="text-xl font-bold">Small-group session</h2>
                        </div>
                        <div className="mb-4">
                            <span className="text-4xl font-extrabold">€30</span>
                            <span className="text-[hsl(var(--muted-foreground))]"> / 30 min per person</span>
                        </div>
                        <ul className="space-y-2 text-sm text-[hsl(var(--muted-foreground))] mb-6">
                            <li className="flex gap-2"><CheckCircle2 size={16} className="text-[hsl(var(--primary))] mt-0.5 shrink-0" /> 3–4 participants — learn from each other&apos;s questions too</li>
                            <li className="flex gap-2"><CheckCircle2 size={16} className="text-[hsl(var(--primary))] mt-0.5 shrink-0" /> Themed around a unit (cap rates, mortgages, waterfalls…)</li>
                            <li className="flex gap-2"><CheckCircle2 size={16} className="text-[hsl(var(--primary))] mt-0.5 shrink-0" /> Bring your questions from the free course</li>
                        </ul>
                        <div className="mt-auto">
                            <BookButton url={GROUP_URL} label="Book a group session" />
                        </div>
                    </div>

                    {/* Individual */}
                    <div className="flex flex-col bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-8">
                        <div className="flex items-center gap-3 mb-3">
                            <User size={22} className="text-[hsl(var(--primary))]" />
                            <h2 className="text-xl font-bold">One-to-one session</h2>
                        </div>
                        <div className="mb-4">
                            <span className="text-4xl font-extrabold">€75</span>
                            <span className="text-[hsl(var(--muted-foreground))]"> / 30 min</span>
                        </div>
                        <ul className="space-y-2 text-sm text-[hsl(var(--muted-foreground))] mb-6">
                            <li className="flex gap-2"><CheckCircle2 size={16} className="text-[hsl(var(--primary))] mt-0.5 shrink-0" /> Your agenda: a model review, a concept, career advice, master&apos;s applications</li>
                            <li className="flex gap-2"><CheckCircle2 size={16} className="text-[hsl(var(--primary))] mt-0.5 shrink-0" /> Share your screen and work through your own file</li>
                            <li className="flex gap-2"><CheckCircle2 size={16} className="text-[hsl(var(--primary))] mt-0.5 shrink-0" /> Fully private and confidential</li>
                        </ul>
                        <div className="mt-auto">
                            <BookButton url={INDIVIDUAL_URL} label="Book a private session" />
                        </div>
                    </div>
                </div>

                {/* How it works */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-14">
                    {[
                        { icon: CalendarClock, title: "1 · Pick a slot", text: "A limited number of sessions open each week." },
                        { icon: CreditCard, title: "2 · Pay securely", text: "Card payment at booking. Full refund up to 24h before." },
                        { icon: Video, title: "3 · Meet live", text: "Video call — link arrives with your confirmation." },
                        { icon: Clock, title: "4 · Keep going", text: "Your first session credits toward the Core course." },
                    ].map((s, i) => (
                        <div key={i} className="p-4 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl">
                            <s.icon size={20} className="text-[hsl(var(--primary))] mb-2" />
                            <div className="font-semibold text-sm mb-1">{s.title}</div>
                            <div className="text-xs text-[hsl(var(--muted-foreground))]">{s.text}</div>
                        </div>
                    ))}
                </div>

                {/* Eligibility + capacity */}
                <div className="max-w-3xl mx-auto text-sm text-[hsl(var(--muted-foreground))] space-y-3 border-t pt-8">
                    <p>
                        <strong className="text-[hsl(var(--foreground))]">Availability.</strong> Office hours are limited to a
                        small number of sessions per week during university term time, so book ahead. More slots open
                        outside term.
                    </p>
                    <p>
                        <strong className="text-[hsl(var(--foreground))]">Eligibility.</strong> To avoid any conflict of
                        interest, office hours are not available to students currently enrolled at — or holding an offer of
                        admission from — the institution where I hold my professorship. Those students already have access
                        to my regular university office hours.
                    </p>
                    <p>
                        <strong className="text-[hsl(var(--foreground))]">Not sure yet?</strong>{" "}
                        <Link href="/course/part-1" className="text-[hsl(var(--primary))] underline underline-offset-2">
                            Start the free course
                        </Link>{" "}
                        first — bring your questions when you&apos;re ready.
                    </p>
                </div>
            </div>
        </div>
    );
}
