"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (singleton).
 * Returns null when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 * are not set — the app then falls back to localStorage-only accounts, so it
 * keeps working end-to-end before the backend is configured (same pattern as
 * the mock Stripe checkout and mock AI tutor).
 */

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
    if (client !== undefined) return client;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
        client = null;
        return client;
    }
    client = createClient(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true, // magic-link redirect lands the session automatically
        },
    });
    return client;
}

export const supabaseEnabled = () =>
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
