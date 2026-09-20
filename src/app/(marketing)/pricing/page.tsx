import { CourseList } from "@/components/CourseList";
import type { Metadata } from "next";
import { PREVIEW_MODE } from "@/lib/flags";

export const metadata: Metadata = {
    title: "Pricing — Real Estate Finance Course",
    description:
        "Start the Real Estate 101 track free, then unlock the REFI Core and Advanced modules. One-time payment, lifetime access, interactive labs and an AI tutor included.",
    alternates: { canonical: "/pricing" },
};

export default function Pricing() {
    return (
        <div className="pt-20">
            <div className="container text-center mb-8">
                <h1 className="text-4xl font-bold">{PREVIEW_MODE ? "Course access" : "Simple, Transparent Pricing"}</h1>
                <p className="mt-4 text-[hsl(var(--muted-foreground))]">
                    {PREVIEW_MODE
                        ? "We're in student beta — all modules are open while we improve the platform."
                        : "Start for free, upgrade for the full experience."}
                </p>
            </div>
            <CourseList />
        </div>
    );
}
