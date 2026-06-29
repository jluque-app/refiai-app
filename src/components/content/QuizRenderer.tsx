"use client";

import React, { useState } from 'react';
import { QuizQuestion } from '@/types/course';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizRendererProps {
    questions: QuizQuestion[];
    title?: string;
}

export function QuizRenderer({ questions, title = "Knowledge Check" }: QuizRendererProps) {
    const [answers, setAnswers] = useState<Record<string, string | number>>({});
    const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

    const handleAnswerChange = (id: string, value: string | number) => {
        setAnswers(prev => ({ ...prev, [id]: value }));
        // Reset submission state if answer changes
        if (submitted[id]) {
            setSubmitted(prev => ({ ...prev, [id]: false }));
        }
    };

    const checkAnswer = (question: QuizQuestion) => {
        setSubmitted(prev => ({ ...prev, [question.id]: true }));
    };

    const isCorrect = (question: QuizQuestion) => {
        const userAnswer = answers[question.id];

        if (question.type === 'number') {
            // Allow for small floating point tolerance or exact match
            return Number(userAnswer) === Number(question.correctAnswer);
        }

        if (question.type === 'short-answer') {
            return String(userAnswer).toLowerCase().trim() === String(question.correctAnswer).toLowerCase().trim();
        }

        return userAnswer === question.correctAnswer;
    };

    return (
        <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
                    <HelpCircle className="w-5 h-5 text-indigo-500" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
                {questions.map((q, idx) => (
                    <div key={q.id} className="space-y-4">
                        <div className="font-medium text-slate-700 dark:text-slate-200">
                            {idx + 1}. {q.text}
                        </div>

                        {/* Question Types */}
                        <div className="space-y-2">
                            {q.type === 'multiple-choice' && q.options?.map((option) => (
                                <div key={option} className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id={`${q.id}-${option}`}
                                        name={q.id}
                                        value={option}
                                        checked={answers[q.id] === option}
                                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <Label htmlFor={`${q.id}-${option}`} className="cursor-pointer">{option}</Label>
                                </div>
                            ))}

                            {(q.type === 'short-answer' || q.type === 'number') && (
                                <Input
                                    type={q.type === 'number' ? 'number' : 'text'}
                                    value={answers[q.id] || ''}
                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                    placeholder={q.type === 'number' ? "Enter number..." : "Your answer..."}
                                    className="max-w-md bg-white dark:bg-slate-950"
                                />
                            )}
                        </div>

                        {/* Actions & Feedback */}
                        <div className="flex items-center gap-4">
                            {!submitted[q.id] ? (
                                <Button
                                    onClick={() => checkAnswer(q)}
                                    size="sm"
                                    disabled={!answers[q.id]}
                                >
                                    Check Answer
                                </Button>
                            ) : (
                                <div className={cn(
                                    "px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium",
                                    isCorrect(q) ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                )}>
                                    {isCorrect(q) ? (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            Correct!
                                        </>
                                    ) : (
                                        <>
                                            <XCircle className="w-4 h-4" />
                                            Incorrect. Try again.
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Explanation — shown after submitting, whether right or wrong */}
                        {submitted[q.id] && q.explanation && (
                            <div className="text-sm text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-950 p-3 rounded border text-muted-foreground">
                                <strong>Explanation:</strong> {q.explanation}
                            </div>
                        )}

                        {idx < questions.length - 1 && <hr className="border-slate-200 dark:border-slate-800" />}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
