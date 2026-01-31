"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/Sidebar";

export function Header() {
    const [open, setOpen] = React.useState(false);
    const pathname = usePathname();

    const links = [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/my-courses", label: "My Courses" },
        { href: "/chat", label: "Expert Chat" },
        { href: "/settings", label: "Settings" },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center gap-4">
                {/* Mobile Menu */}
                <div className="md:hidden">
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle Menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="p-0 w-64">
                            <Sidebar className="border-none" />
                        </SheetContent>
                    </Sheet>
                </div>

                {/* Brand / Logo */}
                <div className="flex items-center gap-2 font-bold text-xl mr-4">
                    <GraduationCap className="h-6 w-6 text-primary" />
                    <span>ReFiAI</span>
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "transition-colors hover:text-foreground/80",
                                pathname.startsWith(link.href) ? "text-foreground" : "text-foreground/60"
                            )}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* Right Side (User/Account) */}
                <div className="flex flex-1 items-center justify-end space-x-2">
                    <Button variant="ghost" size="sm" className="hidden md:flex text-muted-foreground hover:text-destructive">
                        Sign Out
                    </Button>
                </div>
            </div>
        </header>
    );
}
