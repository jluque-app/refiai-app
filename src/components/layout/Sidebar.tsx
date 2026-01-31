"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area"; // I'll need to create this or use a div
import { LayoutDashboard, BookOpen, Settings, MessageSquare, LogOut, GraduationCap } from "lucide-react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();

    const links = [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { href: "/my-courses", label: "My Courses", icon: BookOpen },
        { href: "/chat", label: "Expert Chat", icon: MessageSquare }, // Placeholder
        { href: "/settings", label: "Settings", icon: Settings },
    ];

    return (
        <div className={cn("pb-12 min-h-screen border-r bg-card", className)}>
            <div className="space-y-4 py-4">
                <div className="px-3 py-2">
                    <div className="flex items-center gap-2 px-4 mb-8">
                        <GraduationCap className="h-6 w-6 text-primary" />
                        <h2 className="text-xl font-bold tracking-tight">ReFiAI</h2>
                    </div>
                    <div className="space-y-1">
                        {links.map((link) => (
                            <Button
                                key={link.href}
                                variant={pathname.startsWith(link.href) ? "secondary" : "ghost"}
                                className="w-full justify-start gap-2"
                                asChild
                            >
                                <Link href={link.href}>
                                    <link.icon className="h-4 w-4" />
                                    {link.label}
                                </Link>
                            </Button>
                        ))}
                    </div>
                </div>
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-xs font-semibold tracking-tight text-muted-foreground">
                        Account
                    </h2>
                    <div className="space-y-1">
                        <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive">
                            <LogOut className="h-4 w-4" />
                            Sign Out
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
