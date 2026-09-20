"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CalendarClock, FlaskConical, GraduationCap } from "lucide-react";
import { PREVIEW_MODE } from "@/lib/flags";

export function Hero() {
    return (
        <section className="relative pt-32 pb-20 md:pt-44 md:pb-28 overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[hsl(var(--primary)/0.08)] blur-[100px] rounded-full -z-10" />

            <div className="container mx-auto px-4 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <span className="inline-block px-3 py-1 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] text-sm font-medium mb-6">
                        {PREVIEW_MODE
                            ? "Student beta — full access while we build"
                            : "Real Estate Finance 101 — completely free, no card required"}
                    </span>
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-balance">
                        Real estate finance <br className="hidden md:block" />
                        you actually <span className="text-[hsl(var(--primary))]">practice</span>
                    </h1>
                    <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-10 text-balance">
                        {PREVIEW_MODE
                            ? "Interactive Excel labs, real problem sets, and an AI tutor — built by a professor with 20+ years teaching real estate finance. Explore everything and tell us what to improve."
                            : "Interactive Excel labs, real problem sets, and an AI tutor — built by a professor with 20+ years teaching real estate finance. Start the full foundations course free, then book live office hours when you want to go deeper."}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/course/part-1" className="btn btn-primary text-lg px-8 py-4 rounded-full flex items-center gap-2 group">
                            Start the free course
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link href="/office-hours" className="btn bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] text-lg px-8 py-4 rounded-full flex items-center gap-2">
                            <CalendarClock size={18} /> Book office hours
                        </Link>
                    </div>

                    <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
                        <div className="flex items-start gap-3 p-4 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl">
                            <FlaskConical size={20} className="text-[hsl(var(--primary))] mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold text-sm">12 interactive labs</div>
                                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Move the sliders, watch the proforma react — the Excel models, live in your browser.</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl">
                            <GraduationCap size={20} className="text-[hsl(var(--primary))] mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold text-sm">Real problem sets</div>
                                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">The professor&apos;s own exercises, auto-graded with instant feedback.</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl">
                            <CalendarClock size={20} className="text-[hsl(var(--primary))] mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold text-sm">Live office hours</div>
                                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Small-group or one-to-one sessions with the professor — study online, get taught live.</div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
