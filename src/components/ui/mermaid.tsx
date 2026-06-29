"use client";
import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "loose",
    fontFamily: "inherit"
});

export default function MermaidChart({ chart }: { chart: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>("");

    useEffect(() => {
        const renderChart = async () => {
            try {
                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                const { svg } = await mermaid.render(id, chart);
                setSvg(svg);
            } catch (error) {
                console.error("Mermaid error:", error);
                setSvg(`<div class="text-red-500 text-xs">Error rendering diagram</div>`);
            }
        };

        renderChart();
    }, [chart]);

    // If we have an SVG, render it safely handling HTML
    return (
        <div
            className="mermaid-chart flex justify-center p-6 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 my-4 shadow-sm overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}
