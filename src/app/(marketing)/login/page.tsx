import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
    title: "Sign in",
    description: "Sign in to ReFiAI to continue your real estate finance course.",
    robots: { index: false },
};

export default function Login() {
    return (
        <div className="container mx-auto px-4 py-32 text-center">
            <h1 className="text-3xl font-bold mb-3">Welcome back</h1>
            <p className="text-[hsl(var(--muted-foreground))] mb-10">
                Sign in to continue where you left off.
            </p>
            <AuthForm mode="login" />
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-8">
                New here?{" "}
                <Link href="/signup" className="text-[hsl(var(--primary))] underline underline-offset-2">
                    Create a free account
                </Link>
            </p>
        </div>
    );
}
