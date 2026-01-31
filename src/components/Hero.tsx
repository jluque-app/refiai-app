"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
    return (
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
            {/* Background Gradient/Mesh (Optional) */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[hsl(var(--surface))] to-transparent -z-10" />
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[hsl(var(--primary)/0.1)] blur-[100px] rounded-full -z-10" />

            <div className="container mx-auto px-4 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <span className="inline-block px-3 py-1 rounded-full bg-[hsl(var(--secondary)/0.1)] text-[hsl(var(--secondary))] text-sm font-medium mb-6">
                        The Future of Real Estate Education
                    </span>
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-balance">
                        Master Real Estate Finance <br className="hidden md:block" />
                        with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--primary))] to-blue-400">Artificial Intelligence</span>
                    </h1>
                    <p className="text-lg md:text-xl text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto mb-10 text-balance">
                        A comprehensive, AI-enhanced curriculum designed for students, professionals, and institutions.
                        From Excel basics to advanced MBS & REIT modeling.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/course/part-2" className="btn btn-primary text-lg px-8 py-4 rounded-full flex items-center gap-2 group">
                            Explore Courses
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link href="/about" className="btn bg-[hsl(var(--surface))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] text-lg px-8 py-4 rounded-full">
                            Meet the Instructor
                        </Link>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
