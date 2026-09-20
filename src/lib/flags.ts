/**
 * Feature flags.
 *
 * PREVIEW_MODE — "student beta" switch for the creation phase:
 *  - every lesson is unlocked (no paywall) so testers can explore the full UX
 *  - all prices and cost information are hidden (course cards, pricing page,
 *    office-hours page, nudges, JSON-LD offers)
 * Turn ON by setting NEXT_PUBLIC_PREVIEW_MODE=true (Render → Environment).
 * Turn OFF (or remove) at go-to-market to restore prices + paywall untouched.
 */
export const PREVIEW_MODE = process.env.NEXT_PUBLIC_PREVIEW_MODE === "true";
