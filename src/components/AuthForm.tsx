"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { useUser } from "@/components/UserContext";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
    const { sendMagicLink, cloudAuth, user } = useUser();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = email.trim().toLowerCase();
        if (!/.+@.+\..+/.test(trimmed)) {
            setError("Please enter a valid email address.");
            setState("error");
            return;
        }
        setState("sending");
        setError(null);
        const res = await sendMagicLink(trimmed);
        if (!res.ok) {
            setError(res.error ?? "Something went wrong — please try again.");
            setState("error");
            return;
        }
        if (!cloudAuth) {
            // Local fallback: logged in immediately.
            router.push("/my-courses");
            return;
        }
        setState("sent");
    };

    if (user && state === "idle") {
        return (
            <div className="text-center">
                <p className="text-[hsl(var(--muted-foreground))] mb-4">You&apos;re signed in as <strong className="text-[hsl(var(--foreground))]">{user.email}</strong>.</p>
                <button onClick={() => router.push("/my-courses")} className="btn btn-primary px-6 py-3 rounded-full">
                    Go to my learning
                </button>
            </div>
        );
    }

    if (state === "sent") {
        return (
            <div className="text-center max-w-md mx-auto">
                <CheckCircle2 size={40} className="text-[hsl(var(--primary))] mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Check your email</h2>
                <p className="text-[hsl(var(--muted-foreground))] text-sm">
                    We sent a sign-in link to <strong className="text-[hsl(var(--foreground))]">{email}</strong>.
                    Click it and you&apos;ll be signed in here — no password needed.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="max-w-md mx-auto">
            <label htmlFor="auth-email" className="block text-sm font-medium mb-2 text-left">
                Email address
            </label>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                    <input
                        id="auth-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full pl-9 pr-3 py-3 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                    />
                </div>
                <button type="submit" disabled={state === "sending"} className="btn btn-primary px-5 rounded-xl flex items-center gap-2">
                    {state === "sending" ? <Loader2 size={16} className="animate-spin" /> : null}
                    {mode === "signup" ? "Create account" : "Sign in"}
                </button>
            </div>
            {error && <p className="text-sm text-[hsl(var(--destructive))] mt-2 text-left">{error}</p>}
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-4 text-left">
                No password needed — we email you a secure sign-in link. Your progress and purchases follow
                your email address on any device.
            </p>
        </form>
    );
}
