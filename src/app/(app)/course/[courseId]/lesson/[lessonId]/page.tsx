"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PlayCircle, FileText, Layout, GripVertical, CheckCircle, ArrowLeft } from "lucide-react";
import courseDataRaw from "@/content/course.json";
import { CourseData, Lesson, Unit } from "@/types/course";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import { MortgageMasterSimulator } from "@/components/simulators/MortgageMasterSimulator";
import { WaterfallSimulator } from "@/components/simulators/WaterfallSimulator";
import ExcelSimulator from "@/components/simulators/ExcelSimulator";
import { QuizRenderer } from "@/components/content/QuizRenderer";

// Simulators
import PropertyValuationSimulator from "@/components/simulators/PropertyValuation";
import LeveredReturnsSimulator from "@/components/simulators/LeveredReturns";
import MortgageLabSimulator from "@/components/simulators/MortgageLab";
import SingleAssetValuationSimulator from "@/components/simulators/SingleAssetValuation";
import AffordableHousingFundSimulator from "@/components/simulators/AffordableHousingFund";
import BarcelonaCaseSimulator from "@/components/simulators/BarcelonaCase";
import ValuationLabSimulator from "@/components/simulators/ValuationLab";
import MortgageBalloonLab from "@/components/simulators/MortgageBalloonLab";
import AmortizationLab from "@/components/simulators/AmortizationLab";
import AiTeacher from "@/components/ai/AiTeacher";

const courseData = courseDataRaw as CourseData;

export default function LessonViewer() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.courseId as string;
    const lessonId = params.lessonId as string;

    const coursePart = courseData.parts.find(p => p.id === courseId);

    // Find active unit and lesson
    let activeUnit: Unit | undefined;
    let activeLesson: Lesson | undefined;
    let nextLessonId: string | undefined;
    let prevLessonId: string | undefined;

    if (coursePart) {
        for (let i = 0; i < coursePart.units.length; i++) {
            const unit = coursePart.units[i];
            const lessonIndex = unit.lessons.findIndex(l => l.id === lessonId);
            if (lessonIndex !== -1) {
                activeUnit = unit;
                activeLesson = unit.lessons[lessonIndex];

                // Prev
                if (lessonIndex > 0) {
                    prevLessonId = unit.lessons[lessonIndex - 1].id;
                } else if (i > 0) {
                    const prevUnit = coursePart.units[i - 1];
                    prevLessonId = prevUnit.lessons[prevUnit.lessons.length - 1].id;
                }

                // Next
                if (lessonIndex < unit.lessons.length - 1) {
                    nextLessonId = unit.lessons[lessonIndex + 1].id;
                } else if (i < coursePart.units.length - 1) {
                    nextLessonId = coursePart.units[i + 1].lessons[0].id; // First lesson of next unit
                }
                break;
            }
        }
    }

    if (!coursePart || !activeLesson) {
        return <div className="p-8">Lesson not found.</div>;
    }

    const renderContent = () => {
        // Legacy Support (Backward Compatibility)
        if (!activeLesson?.sections || activeLesson.sections.length === 0) {
            return renderLegacyContent();
        }

        // New Sections Schema
        return (
            <div className="space-y-8">
                {activeLesson.sections.map((section, index) => {
                    switch (section.type) {
                        case 'markdown':
                            return (
                                <Card key={index} className="border-0 shadow-none bg-transparent">
                                    <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary hover:prose-a:text-primary/80">
                                        <ReactMarkdown>{section.content || ""}</ReactMarkdown>
                                    </div>
                                </Card>
                            );
                        case 'video':
                            return (
                                <Card key={index} className="overflow-hidden border-0 shadow-lg bg-black">
                                    <div className="aspect-video">
                                        <video
                                            src={section.content}
                                            controls
                                            className="w-full h-full object-contain"
                                        >
                                            Your browser does not support the video tag.
                                        </video>
                                    </div>
                                </Card>
                            );
                        case 'simulator':
                            return (
                                <Card key={index} className="border shadow-md min-h-[400px] overflow-hidden">
                                    <div className="bg-muted px-4 py-2 border-b flex items-center justify-between">
                                        <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Interactive Simulator</div>
                                        <Badge variant="outline" className="bg-background text-xs">Mini Lab</Badge>
                                    </div>
                                    <div className={clsx("p-4 bg-muted/20 h-full", section.props?.variant === 'mini' ? 'min-h-[300px]' : 'min-h-[600px]')}>
                                        {/* Dynamic Simulator Rendering */}
                                        {section.simulatorId === 'PropertyValuationSimulator' && <PropertyValuationSimulator {...section.props} />}
                                        {section.simulatorId === 'LeveredReturnsSimulator' && <LeveredReturnsSimulator {...section.props} />}
                                        {section.simulatorId === 'MortgageLabSimulator' && <MortgageLabSimulator {...section.props} />}
                                        {section.simulatorId === 'MortgageMasterSimulator' && <MortgageMasterSimulator {...section.props} />}
                                        {section.simulatorId === 'WaterfallSimulator' && <WaterfallSimulator {...section.props} />}
                                        {section.simulatorId === 'ExcelSimulator' && <ExcelSimulator {...section.props} />}
                                        {section.simulatorId === 'SingleAssetValuationSimulator' && <SingleAssetValuationSimulator {...section.props} />}
                                        {section.simulatorId === 'AffordableHousingFundSimulator' && <AffordableHousingFundSimulator {...section.props} />}
                                        {section.simulatorId === 'BarcelonaCaseSimulator' && <BarcelonaCaseSimulator {...section.props} />}
                                        {section.simulatorId === 'ValuationLabSimulator' && <ValuationLabSimulator {...section.props} />}
                                        {section.simulatorId === 'MortgageBalloonLab' && <MortgageBalloonLab {...section.props} />}
                                        {section.simulatorId === 'AmortizationLab' && <AmortizationLab {...section.props} />}
                                    </div>
                                </Card>
                            );
                        case 'quiz':
                            if (!section.quizData) return null;
                            return (
                                <QuizRenderer
                                    key={index}
                                    questions={section.quizData}
                                    title={section.content || "Knowledge Check"}
                                />
                            );
                        default:
                            return <div key={index} className="text-muted-foreground italic">Unsupported section type: {section.type}</div>;
                    }
                })}
                {activeLesson?.resources && activeLesson.resources.length > 0 && (
                    <div className="mt-2">
                        <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3">Downloads</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {activeLesson.resources.map((res, i) => (
                                <a key={i} href={res.path} download className="flex items-center gap-3 p-3 bg-card border rounded-md hover:border-primary/50 hover:bg-muted/50 transition-colors">
                                    <FileText size={16} className="text-primary shrink-0" />
                                    <span className="text-sm font-medium">{res.title}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderLegacyContent = () => {
        switch (activeLesson?.type) {
            case 'video':
                return (
                    <Card className="overflow-hidden border-0 shadow-lg bg-black">
                        <div className="aspect-video">
                            <video
                                src={activeLesson.contentUrl}
                                controls
                                className="w-full h-full object-contain"
                            >
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </Card>
                );
            case 'simulator':
                return (
                    <Card className="border shadow-md min-h-[600px] overflow-hidden">
                        <div className="bg-muted px-4 py-2 border-b flex items-center justify-between">
                            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Interactive Simulator</div>
                            <Badge variant="outline" className="bg-background text-xs">Beta</Badge>
                        </div>
                        <div className="p-4 bg-muted/20 h-full">
                            {activeLesson.simulatorId === 'PropertyValuationSimulator' && <PropertyValuationSimulator />}
                            {activeLesson.simulatorId === 'LeveredReturnsSimulator' && <LeveredReturnsSimulator />}
                            {activeLesson.simulatorId === 'MortgageLabSimulator' && <MortgageLabSimulator />}
                            {activeLesson.simulatorId === 'SingleAssetValuationSimulator' && <SingleAssetValuationSimulator />}
                            {activeLesson.simulatorId === 'AffordableHousingFundSimulator' && <AffordableHousingFundSimulator />}
                            {activeLesson.simulatorId === 'BarcelonaCaseSimulator' && <BarcelonaCaseSimulator />}
                        </div>
                    </Card>
                );
            case 'slide':
            case 'article':
                return (
                    <Card className="border-0 shadow-none bg-transparent">
                        <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary hover:prose-a:text-primary/80">
                            <h3>{activeLesson.title}</h3>
                            <p className="lead text-muted-foreground">{activeLesson.description || "No description available."}</p>

                            {activeLesson.contentUrl && (
                                <div className="not-prose flex items-center gap-4 p-4 mt-6 bg-muted/50 rounded-lg border">
                                    <div className="p-2 bg-background rounded border">
                                        <FileText size={24} className="text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">Download / View Content</div>
                                        <div className="text-xs text-muted-foreground truncate">{activeLesson.contentUrl}</div>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={activeLesson.contentUrl} target="_blank">Open</a>
                                    </Button>
                                </div>
                            )}

                            {activeLesson.resources && (
                                <div className="mt-8">
                                    <h4 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4">Downloads</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 not-prose">
                                        {activeLesson.resources.map((res, i) => (
                                            <a key={i} href={res.path} download className="flex items-center gap-3 p-3 bg-card border rounded-md hover:border-primary/50 hover:bg-muted/50 transition-colors group">
                                                <div className="p-2 bg-muted rounded text-primary group-hover:bg-background">
                                                    <FileText size={16} />
                                                </div>
                                                <div className="text-sm font-medium">{res.title}</div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                );
            default:
                return <div>Unknown content type</div>;
        }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            {/* Sidebar - Unit/Lesson List */}
            <div className="w-80 border-r bg-muted/10 hidden lg:flex flex-col shrink-0">
                <div className="p-4 border-b">
                    <Button variant="ghost" size="sm" className="mb-2 p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-primary" asChild>
                        <Link href="/my-courses" className="flex items-center gap-1">
                            <ArrowLeft size={16} /> Back to Courses
                        </Link>
                    </Button>
                    <h2 className="font-bold text-lg leading-tight tracking-tight">{coursePart.title}</h2>
                </div>

                <ScrollArea className="flex-1">
                    {coursePart.units.map(unit => (
                        <div key={unit.id} className="border-b last:border-0">
                            <div className="px-4 py-3 bg-muted/30 font-semibold text-xs uppercase tracking-wider flex items-center gap-2 text-muted-foreground">
                                {unit.title}
                            </div>
                            <div>
                                {unit.lessons.map(lesson => {
                                    const isActive = lesson.id === lessonId;
                                    const Icon = lesson.type === 'video' ? PlayCircle : (lesson.type === 'simulator' ? Layout : FileText);

                                    return (
                                        <Link
                                            key={lesson.id}
                                            href={`/course/${courseId}/lesson/${lesson.id}`}
                                            className={clsx(
                                                "flex items-center gap-3 px-4 py-3 text-sm transition-all border-l-2",
                                                isActive
                                                    ? "bg-primary/5 border-l-primary text-primary font-medium"
                                                    : "border-l-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <Icon size={16} className={isActive ? "text-primary fill-primary/10" : "opacity-70"} />
                                            <span className="line-clamp-1">{lesson.title}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </ScrollArea>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
                {/* Top Bar for Mobile/Breadcrumbs could go here */}

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-4xl mx-auto">
                        <header className="mb-8">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                <Badge variant="outline" className="font-normal text-muted-foreground">{activeUnit?.title}</Badge>
                                <ChevronRight size={14} />
                                <span className="text-foreground font-medium">{activeLesson.title}</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-4">{activeLesson.title}</h1>
                        </header>

                        <main className="mb-24">
                            {renderContent()}
                        </main>
                    </div>
                </div>

                {/* Footer Navigation */}
                <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex justify-between items-center shrink-0 max-w-4xl mx-auto w-full">
                    <Button
                        variant="outline"
                        onClick={() => prevLessonId && router.push(`/course/${courseId}/lesson/${prevLessonId}`)}
                        disabled={!prevLessonId}
                        className="gap-2"
                    >
                        <ChevronLeft size={16} /> Previous
                    </Button>

                    <Button
                        onClick={() => nextLessonId && router.push(`/course/${courseId}/lesson/${nextLessonId}`)}
                        disabled={!nextLessonId}
                        className="gap-2"
                    >
                        {nextLessonId ? "Next Lesson" : "Finish Unit"} <ChevronRight size={16} />
                    </Button>
                </div>
            </div>

            {/* AI Teacher Chat */}
            <AiTeacher />

        </div>
    );
}
