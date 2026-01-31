import Link from "next/link";
import { CheckCircle2, BookOpen, Clock } from "lucide-react";
import courseData from "@/content/course.json";

export function CourseList() {
    return (
        <section className="py-20 bg-[hsl(var(--surface))]">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Curriculum</h2>
                    <p className="text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
                        Structured into three comprehensive parts, taking you from novice to expert.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {courseData.parts.map((part) => (
                        <div
                            key={part.id}
                            className="flex flex-col bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-[var(--radius)] overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1"
                        >
                            <div className="p-6 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-[hsl(var(--primary))] uppercase tracking-wider">
                                        {part.id === 'part-2' ? 'Most Popular' : part.id.replace('-', ' ')}
                                    </span>
                                    {part.price === 0 ? (
                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">FREE</span>
                                    ) : (
                                        <span className="font-bold text-lg">${part.price}</span>
                                    )}
                                </div>
                                <h3 className="text-2xl font-bold mb-2">{part.title}</h3>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">{part.description}</p>
                            </div>

                            <div className="p-6 flex-grow">
                                <h4 className="font-medium mb-4 flex items-center gap-2">
                                    <BookOpen size={16} /> {part.units.length} Units
                                </h4>
                                <ul className="space-y-3">
                                    {part.units.map((unit) => (
                                        <li key={unit.id} className="flex items-start gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                            <CheckCircle2 size={16} className="text-[hsl(var(--primary))] mt-0.5 shrink-0" />
                                            <span>{unit.title}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="p-6 pt-0 mt-auto">
                                <Link
                                    href={`/course/${part.id}`}
                                    className="btn btn-primary w-full justify-center"
                                >
                                    {part.price === 0 ? "Start Learning" : "View Details"}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
