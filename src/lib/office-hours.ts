"use client";

/**
 * Earned-moment office-hours prompts.
 * Fire `nudgeOfficeHours(reason)` from anywhere in the app; the
 * <OfficeHoursNudge /> listener decides whether to actually show it:
 *  - at most one nudge per browser session
 *  - a dismissed reason is never shown again on this device
 *  - never during an active quiz attempt (the quiz trigger itself fires
 *    only after a second failed attempt, which is an earned moment)
 */

export type OfficeHoursReason = "quiz" | "tutor" | "unit";

export const OH_EVENT = "refiai:office-hours-nudge";

export function nudgeOfficeHours(reason: OfficeHoursReason, detail?: string) {
    if (typeof window === "undefined") return;
    try {
        if (sessionStorage.getItem("refiai_oh_shown")) return; // one per session
        if (localStorage.getItem(`refiai_oh_dismissed_${reason}`)) return; // remembered dismissal
    } catch {
        /* storage unavailable — fail quiet */
    }
    window.dispatchEvent(new CustomEvent(OH_EVENT, { detail: { reason, detail } }));
}
