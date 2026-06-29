"use client";

import { cn } from "@/lib/utils";
import * as motion from "framer-motion/client";

interface DeckSlideProps {
    className?: string;
    children: React.ReactNode;
    id?: string;
}

export function DeckSlide({ className, children, id }: DeckSlideProps) {
    return (
        <section
            id={id}
            className={cn(
                "h-screen w-full snap-start flex flex-col justify-center px-6 md:px-20 relative overflow-hidden border-b border-slate-200",
                className
            )}
        >
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                viewport={{ once: false, amount: 0.3 }}
                className="w-full mx-auto relative z-10"
            >
                {children}
            </motion.div>
        </section>
    );
}
