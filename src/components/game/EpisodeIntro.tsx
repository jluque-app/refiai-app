"use client";

import { useEffect, useState } from "react";
import { PlayCircle, X, GraduationCap } from "lucide-react";
import { EPISODE_VIDEOS, driveEmbedUrl } from "@/lib/game/episode-videos";

/**
 * "The Professor's Briefing" — the episode intro video.
 *
 * Shows automatically the first time a student opens an episode (remembered per
 * browser), and can always be re-opened from the HUD. If no video has been
 * published for the episode yet, this renders nothing at all, so the game works
 * exactly as before.
 */
export default function EpisodeIntro({
    episodeId,
    title,
    city,
    topics,
    syllabusDays,
    forceOpen,
    onClose,
}: {
    episodeId: string;
    title: string;
    city: string;
    topics: string;
    syllabusDays?: string;
    forceOpen?: boolean;
    onClose?: () => void;
}) {
    const fileId = EPISODE_VIDEOS[episodeId] ?? null;
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!fileId) return;
        if (forceOpen) { setOpen(true); return; }
        try {
            if (!localStorage.getItem(`refiai_intro_seen_${episodeId}`)) setOpen(true);
        } catch { /* ignore */ }
    }, [fileId, episodeId, forceOpen]);

    if (!fileId || !open) return null;

    const close = () => {
        try { localStorage.setItem(`refiai_intro_seen_${episodeId}`, "1"); } catch { /* ignore */ }
        setOpen(false);
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={close} />
            <div className="relative w-full max-w-4xl bg-[hsl(var(--card))] rounded-2xl border shadow-2xl overflow-hidden">
                <div className="flex items-start justify-between gap-4 p-5 border-b">
                    <div>
                        <div className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                            <GraduationCap size={14} /> The Professor&apos;s Briefing
                            {syllabusDays && <span>· {syllabusDays}</span>}
                        </div>
                        <h2 className="text-xl font-bold mt-1">{city} — {title}</h2>
                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{topics}</p>
                    </div>
                    <button onClick={close} aria-label="Close briefing" className="shrink-0 p-2 rounded-full hover:bg-[hsl(var(--muted))]">
                        <X size={18} />
                    </button>
                </div>

                <div className="aspect-video bg-black">
                    <iframe
                        src={driveEmbedUrl(fileId)}
                        className="w-full h-full"
                        allow="autoplay; encrypted-media; fullscreen"
                        allowFullScreen
                        title={`${city} episode briefing`}
                    />
                </div>

                <div className="flex items-center justify-between gap-3 p-4">
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        Watch this before you play — it teaches the finance you&apos;re about to use.
                    </p>
                    <button onClick={close} className="btn btn-primary px-5 py-2.5 rounded-full text-sm flex items-center gap-2">
                        <PlayCircle size={16} /> Start playing
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Small HUD button to re-open the briefing. Renders nothing if no video exists. */
export function BriefingButton({ episodeId, onOpen }: { episodeId: string; onOpen: () => void }) {
    if (!EPISODE_VIDEOS[episodeId]) return null;
    return (
        <button
            onClick={onOpen}
            title="Rewatch the Professor's briefing"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border hover:bg-[hsl(var(--muted))]"
        >
            <PlayCircle size={14} /> Briefing
        </button>
    );
}
