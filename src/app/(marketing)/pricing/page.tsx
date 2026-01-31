import { CourseList } from "@/components/CourseList";

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
