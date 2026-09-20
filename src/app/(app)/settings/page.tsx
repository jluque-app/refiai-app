"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Moon, RefreshCw, Settings as SettingsIcon, User } from "lucide-react";
import { useUser } from "@/components/UserContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export default function Settings() {
    const { user, logout, completed, cloudAuth } = useUser();
    const router = useRouter();
    const [confirmReset, setConfirmReset] = useState(false);

    const resetProgress = () => {
        try {
            localStorage.removeItem("refiai_completed");
        } catch { /* ignore */ }
        window.location.reload();
    };

    return (
        <div className="container mx-auto px-4 py-10 max-w-2xl">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <SettingsIcon size={24} className="text-[hsl(var(--primary))]" /> Settings
                </h1>
            </header>

            <div className="space-y-6">
                {/* Account */}
                <section className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6">
                    <h2 className="font-semibold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        <User size={15} /> Account
                    </h2>
                    {user ? (
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <div className="font-medium">{user.name || user.email}</div>
                                <div className="text-sm text-[hsl(var(--muted-foreground))]">{user.email}</div>
                                {!cloudAuth && (
                                    <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                        Progress is stored in this browser.
                                    </div>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    logout();
                                    router.push("/");
                                }}
                                className="gap-2"
                            >
                                <LogOut size={15} /> Sign out
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                You&apos;re not signed in — progress is stored in this browser only.
                            </p>
                            <Button asChild>
                                <Link href="/login">Sign in</Link>
                            </Button>
                        </div>
                    )}
                </section>

                {/* Appearance */}
                <section className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6">
                    <h2 className="font-semibold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        <Moon size={15} /> Appearance
                    </h2>
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Switch between light and dark mode. Your choice is remembered on this device.
                        </p>
                        <ThemeToggle />
                    </div>
                </section>

                {/* Progress */}
                <section className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6">
                    <h2 className="font-semibold mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                        <RefreshCw size={15} /> Progress
                    </h2>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            {completed.length} lesson{completed.length === 1 ? "" : "s"} marked complete on this device.
                        </p>
                        {confirmReset ? (
                            <div className="flex items-center gap-2">
                                <Button variant="destructive" size="sm" onClick={resetProgress}>
                                    Yes, reset
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)}>
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
                                Reset local progress
                            </Button>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
