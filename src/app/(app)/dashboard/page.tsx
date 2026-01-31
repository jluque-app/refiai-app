import Link from "next/link";
import { Clock, TrendingUp, Award, ArrowRight, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Welcome back, Student</h1>
                <p className="text-muted-foreground mt-2">Pick up where you left off in your Real Estate Finance journey.</p>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Hours Learned</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12.5</div>
                        <p className="text-xs text-muted-foreground mt-1">+2.5 hours this week</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Course Progress</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">35%</div>
                        <Progress value={35} className="mt-2 h-2" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Certificates</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-muted-foreground mt-1">Next certificate at 100%</p>
                    </CardContent>
                </Card>
            </div>

            {/* Continue Learning */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Continue Learning</CardTitle>
                        <CardDescription>You are currently working on Module 1.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            <div className="flex items-center">
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                                    <PlayCircle className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">Real Estate 101: Economics</p>
                                    <p className="text-sm text-muted-foreground">Unit 0.2 - Present Value Math</p>
                                </div>
                                <div className="ml-auto font-medium">
                                    <Button asChild size="sm">
                                        <Link href="/course/part-1">Resume <ArrowRight className="ml-2 h-4 w-4" /></Link>
                                    </Button>
                                </div>
                            </div>

                            {/* Example of upcoming lessons list could go here */}
                            <div className="border-t pt-4">
                                <h4 className="text-sm font-semibold mb-3">Up Next</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Unit 0.3 - Cap Rates Explained</span>
                                        <Badge variant="outline">15 min</Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Unit 1.0 - Intro to Proforma</span>
                                        <Badge variant="outline">25 min</Badge>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recommended Tools</CardTitle>
                        <CardDescription>Simulators relevant to your progress.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                            <div>
                                <p className="text-sm font-medium">Property Valuation</p>
                                <p className="text-xs text-muted-foreground">Core DCF Model</p>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/course/part-2/lesson/lesson-4-1">Open</Link>
                            </Button>
                        </div>
                        <div className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                            <div>
                                <p className="text-sm font-medium">Levered Returns</p>
                                <p className="text-xs text-muted-foreground">Debt & Equity Analysis</p>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/course/part-2/lesson/lesson-5-1">Open</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
