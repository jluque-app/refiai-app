import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
    title: "Create your free account",
    description:
        "Create a free ReFiAI account and start Real Estate Finance 101 — interactive labs, problem sets and an AI tutor. No card required.",
    alternates: { canonical: "/signup" },
};

export default function Signup() {
    return (
        <div className="container mx-auto px-4 py-32 text-center">
            <h1 className="text-3xl font-bold mb-3">Start learning — free</h1>
            <p className="text-[hsl(var(--muted-foreground))] mb-10 max-w-md mx-auto">
                Real Estate Finance 101 is completely free. No card, no trial — just your email so your
                progress is saved.
            </p>
            <AuthForm mode="signup" />
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-8">
                Already have an account?{" "}
                <Link href="/login" className="text-[hsl(var(--primary))] underline underline-offset-2">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
