"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { Send, Bot, X, Loader2, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import clsx from "clsx";
import courseDataRaw from "@/content/course.json";
import { CourseData } from "@/types/course";

const courseData = courseDataRaw as CourseData;

interface Message {
  role: "user" | "assistant";
  content: string;
  qaId?: string;
  rating?: "up" | "down";
}

// Lesson-aware starter prompts; falls back to generic ones.
const STARTERS: Record<string, string[]> = {
  "lesson-1-1": ["What are the two components of return?", "Why is money made when you buy?"],
  "lesson-1-2": ["Why is R₀ = r − g?", "When should I use DCF instead of a cap rate?"],
  "lesson-1-3": ["What does the cap-rate slider do?", "When is leverage negative?"],
  "lesson-1-4": ["Which Excel function gives the mortgage payment?", "How do I compute NOI?"],
  "lesson-1-5": ["How is EGI calculated?", "What exactly is IRR?"],
};
const GENERIC_STARTERS = [
  "Explain this lesson in simple terms",
  "Give me a worked example in euros",
  "Quiz me on this topic",
];

export default function AiTeacher() {
  const params = useParams();
  const courseId = (params?.courseId as string) || undefined;
  const lessonId = (params?.lessonId as string) || undefined;

  // Resolve the human-readable location from course.json
  const location = useMemo(() => {
    if (!lessonId) return null;
    for (const part of courseData.parts) {
      for (const unit of part.units) {
        const lesson = unit.lessons.find((l) => l.id === lessonId);
        if (lesson) return { partId: part.id, unitId: unit.id, unitTitle: unit.title, lessonTitle: lesson.title };
      }
    }
    return null;
  }, [lessonId]);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const starters = (lessonId && STARTERS[lessonId]) || GENERIC_STARTERS;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsLoading(true);

    // Placeholder assistant message we stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          context: { partId: courseId, unitId: location?.unitId, lessonId },
        }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");
      const qaId = res.headers.get("x-qa-id") || undefined;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc, qaId };
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: "Sorry — I couldn't reach the tutor just now. Please try again.",
        };
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const rate = async (idx: number, rating: "up" | "down") => {
    const msg = messages[idx];
    if (!msg?.qaId) return;
    setMessages((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], rating };
      return next;
    });
    try {
      await fetch("/api/teacher/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refId: msg.qaId, rating }),
      });
    } catch {
      /* non-blocking */
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className={clsx(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-xl transition-all hover:scale-105",
          isOpen ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
        )}
        aria-label="AI Tutor"
      >
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </Button>

      {isOpen && (
        <Card className="fixed bottom-24 right-6 z-50 w-[350px] sm:w-[400px] h-[600px] shadow-2xl flex flex-col border-primary/20">
          <CardHeader className="p-4 border-b bg-muted/30">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot size={18} className="text-primary" />
                AI Tutor
                <Badge variant="outline" className="text-[10px] font-normal">
                  Grounded
                </Badge>
              </CardTitle>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {location ? `Context: ${location.unitTitle} › ${location.lessonTitle}` : "Real Estate Finance & Investment"}
            </p>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-hidden relative">
            <ScrollArea className="h-full px-4 py-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 pt-10">
                  <Bot size={44} className="opacity-40" />
                  <p className="text-sm text-muted-foreground max-w-[230px]">
                    Hi! I&apos;m grounded in this course&apos;s material. Ask me anything, or try a starter:
                  </p>
                  <div className="flex flex-col gap-2 w-full">
                    {starters.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-xs text-left border border-border rounded-lg px-3 py-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 pb-4">
                {messages.map((m, i) => (
                  <div key={i} className={clsx("flex w-full", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div className="max-w-[88%]">
                      <div
                        className={clsx(
                          "rounded-2xl px-4 py-3 text-sm shadow-sm whitespace-pre-wrap",
                          m.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-none"
                            : "bg-muted text-foreground rounded-bl-none"
                        )}
                      >
                        {m.content || (isLoading && i === messages.length - 1 ? <Loader2 size={16} className="animate-spin" /> : "")}
                      </div>
                      {m.role === "assistant" && m.content && m.qaId && (
                        <div className="flex items-center gap-1 mt-1 ml-1">
                          <button
                            onClick={() => rate(i, "up")}
                            className={clsx("p-1 rounded hover:bg-muted", m.rating === "up" && "text-primary")}
                            aria-label="Helpful"
                          >
                            <ThumbsUp size={13} />
                          </button>
                          <button
                            onClick={() => rate(i, "down")}
                            className={clsx("p-1 rounded hover:bg-muted", m.rating === "down" && "text-destructive")}
                            aria-label="Not helpful"
                          >
                            <ThumbsDown size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-3 border-t bg-background flex-col gap-1">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex w-full gap-2"
            >
              <Input
                placeholder="Ask about this lesson…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send size={16} />
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground text-center w-full">
              Answers come from your course material. Your feedback trains the tutor.
            </p>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
