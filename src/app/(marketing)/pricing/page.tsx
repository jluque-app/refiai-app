import { CourseList } from "@/components/CourseList";
import type { Metadata } from "next";

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
                <h1 className="text-4xl font-bold">Simple, Transparent Pricing</h1>
                <p className="mt-4 text-[hsl(var(--muted-foreground))]">Start for free, upgrade for the full experience.</p>
            </div>
            <CourseList />
        </div>
    );
}
