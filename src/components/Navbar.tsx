"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { User, Menu, X } from "lucide-react";
import clsx from "clsx";

export function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            className={clsx(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                scrolled
                    ? "bg-[hsl(var(--background)/0.8)] backdrop-blur-md border-b border-[hsl(var(--border))]"
                    : "bg-transparent"
            )}
        >
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="text-xl font-bold tracking-tight">
                    ReFi<span className="text-[hsl(var(--primary))]">AI</span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-8">
                    <Link href="/courses" className="text-sm font-medium hover:text-[hsl(var(--primary))] transition-colors">
                        Courses
                    </Link>
                    <Link href="/about" className="text-sm font-medium hover:text-[hsl(var(--primary))] transition-colors">
                        About
                    </Link>
                    <Link href="/pricing" className="text-sm font-medium hover:text-[hsl(var(--primary))] transition-colors">
                        Pricing
                    </Link>
                </nav>

                <div className="hidden md:flex items-center gap-4">
                    <Link href="/login" className="text-sm font-medium hover:text-[hsl(var(--primary))] transition-colors">
                        Log in
                    </Link>
                    <Link href="/signup" className="btn btn-primary text-sm px-4 py-2 rounded-full">
                        Get Started
                    </Link>
                </div>

                {/* Mobile Toggle */}
                <button
                    className="md:hidden p-2 text-[hsl(var(--foreground))]"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden absolute top-16 left-0 right-0 bg-[hsl(var(--background))] border-b border-[hsl(var(--border))] p-4 flex flex-col gap-4 shadow-lg">
                    <Link href="/courses" className="text-sm font-medium p-2" onClick={() => setMobileMenuOpen(false)}>
                        Courses
                    </Link>
                    <Link href="/about" className="text-sm font-medium p-2" onClick={() => setMobileMenuOpen(false)}>
                        About
                    </Link>
                    <Link href="/pricing" className="text-sm font-medium p-2" onClick={() => setMobileMenuOpen(false)}>
                        Pricing
                    </Link>
                    <div className="h-px bg-[hsl(var(--border))]" />
                    <Link href="/login" className="text-sm font-medium p-2" onClick={() => setMobileMenuOpen(false)}>
                        Log in
                    </Link>
                    <Link href="/signup" className="btn btn-primary text-sm w-full text-center" onClick={() => setMobileMenuOpen(false)}>
                        Get Started
                    </Link>
                </div>
            )}
        </header>
    );
}
