"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, X, KeyRound, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import clsx from "clsx";

// System prompt from legacy ai_teacher_chat.py
const SYSTEM_PROMPT = `You are a friendly, patient real estate finance teacher for a Property-Level Valuation module. 
Explain step-by-step, define jargon clearly, and use small numeric examples in euros when helpful. 
Focus on: PGI, Vacancy, EGI, Operating Expenses (Opex), NOI, Capital Improvements (CapEx), PBTCF, 
Direct Capitalization vs DCF, discount rate vs cap rate, terminal value, Net Sale Price (NSP), and IRR. 
When asked about an input field in the app, explain its role, typical ranges, and caveats. 
Keep answers concise but educational; avoid over-technical language unless the user asks for more depth.`;

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export default function AiTeacher() {
    const [isOpen, setIsOpen] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'system', content: SYSTEM_PROMPT }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasKey, setHasKey] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Check local storage for key
        const storedKey = localStorage.getItem('openai_api_key');
        if (storedKey) {
            setApiKey(storedKey);
            setHasKey(true);
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);

    const handleSaveKey = () => {
        if (apiKey.startsWith('sk-')) {
            localStorage.setItem('openai_api_key', apiKey);
            setHasKey(true);
        } else {
            alert('Invalid API Key format. Must start with sk-');
        }
    };

    const handleClearKey = () => {
        localStorage.removeItem('openai_api_key');
        setApiKey('');
        setHasKey(false);
    };

    const sendMessage = async () => {
        if (!input.trim() || !hasKey) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini', // or gpt-3.5-turbo
                    messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
                    temperature: 0.3,
                    stream: true
                })
            });

            if (!response.ok) throw new Error('API Request failed');

            // Handle streaming
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No reader available');

            let assistantMsg: Message = { role: 'assistant', content: '' };
            setMessages(prev => [...prev, assistantMsg]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.choices[0]?.delta?.content || '';
                            if (content) {
                                assistantMsg.content += content;
                                setMessages(prev => {
                                    const newMsgs = [...prev];
                                    newMsgs[newMsgs.length - 1] = { ...assistantMsg };
                                    return newMsgs;
                                });
                            }
                        } catch (e) {
                            console.error('Error parsing stream', e);
                        }
                    }
                }
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Could not fetch response. Check your API Key.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Toggle Button */}
            <Button
                onClick={() => setIsOpen(!isOpen)}
                size="icon"
                className={clsx(
                    "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-xl transition-all hover:scale-105",
                    isOpen ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
                )}
            >
                {isOpen ? <X size={24} /> : <Sparkles size={24} />}
            </Button>

            {/* Chat Window - Using Card */}
            {isOpen && (
                <Card className="fixed bottom-24 right-6 z-50 w-[350px] sm:w-[400px] h-[600px] shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 fade-in border-primary/20">
                    <CardHeader className="p-4 border-b bg-muted/30">
                        <div className="flex justify-between items-center">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Bot size={18} className="text-primary" />
                                AI Teacher
                                <Badge variant="outline" className="text-[10px] font-normal">GPT-4o</Badge>
                            </CardTitle>
                            {hasKey && (
                                <Button variant="ghost" size="sm" onClick={handleClearKey} className="h-6 text-xs text-muted-foreground hover:text-destructive">
                                    Reset Key
                                </Button>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent className="p-0 flex-1 overflow-hidden relative">
                        {!hasKey ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
                                <div className="p-4 bg-muted rounded-full">
                                    <KeyRound size={32} className="text-muted-foreground" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="font-semibold">Enter OpenAI API Key</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Your key is stored locally in your browser and never sent to our servers.
                                    </p>
                                </div>
                                <div className="w-full space-y-2">
                                    <Input
                                        type="password"
                                        placeholder="sk-..."
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        className="text-center"
                                    />
                                    <Button onClick={handleSaveKey} className="w-full">
                                        Save Key
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Don't have a key? <a href="https://platform.openai.com/" target="_blank" className="underline hover:text-primary">Get one here</a>.
                                </p>
                            </div>
                        ) : (
                            <ScrollArea className="h-full px-4 py-4">
                                {messages.filter(m => m.role !== 'system').length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 opacity-50">
                                        <Bot size={48} />
                                        <p className="text-sm max-w-[200px]">
                                            👋 Hi! I'm your Real Estate Finance Teacher. Ask me about definitions, formulas, or the simulator!
                                        </p>
                                    </div>
                                )}
                                <div className="space-y-4 pb-4">
                                    {messages.filter(m => m.role !== 'system').map((m, i) => (
                                        <div key={i} className={clsx(
                                            "flex w-full",
                                            m.role === 'user' ? "justify-end" : "justify-start"
                                        )}>
                                            <div className={clsx(
                                                "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                                m.role === 'user'
                                                    ? "bg-primary text-primary-foreground rounded-br-none"
                                                    : "bg-muted text-foreground rounded-bl-none"
                                            )}>
                                                {m.content}
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-none">
                                                <Loader2 size={16} className="animate-spin text-muted-foreground" />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>

                    <CardFooter className="p-3 border-t bg-background">
                        <form
                            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                            className="flex w-full gap-2"
                        >
                            <Input
                                placeholder="Ask a question..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={isLoading || !hasKey}
                                className="flex-1"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={isLoading || !input.trim() || !hasKey}
                            >
                                <Send size={16} />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}
        </>
    );
}
