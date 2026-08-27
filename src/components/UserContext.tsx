"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getSupabase, supabaseEnabled } from "@/lib/supabase";

/**
 * UserContext — accounts, entitlements and progress.
 *
 * Two modes, automatic:
 *  - Supabase configured (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY): real accounts
 *    via magic-link email login; entitlements and progress live in Postgres
 *    (see supabase/schema.sql) and follow the student across devices.
 *    localStorage remains a warm cache, and any progress made before first
 *    login is migrated up automatically.
 *  - Not configured: everything persists to localStorage only (previous
 *    behaviour) so the app still works end-to-end in development.
 */

interface Account {
  email: string;
  name?: string;
  id?: string; // supabase auth uid when in cloud mode
}

interface UserContextType {
  // auth
  user: Account | null;
  cloudAuth: boolean; // true when Supabase is configured
  login: (email: string, name?: string) => void; // local fallback login
  sendMagicLink: (email: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  // entitlements (per part / "module")
  unlockedCourses: string[];
  unlockCourse: (courseId: string) => void;
  isUnlocked: (courseId: string) => boolean;
  // progress
  completed: string[];
  toggleComplete: (lessonId: string) => void;
  isComplete: (lessonId: string) => boolean;
  completedCount: (lessonIds: string[]) => number;
}

const FREE_PART = "part-1";
const K_USER = "refiai_user";
const K_UNLOCKED = "refiai_unlocked";
const K_COMPLETED = "refiai_completed";

const UserContext = createContext<UserContextType | undefined>(undefined);

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [unlockedCourses, setUnlockedCourses] = useState<string[]>([FREE_PART]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const cloudAuth = supabaseEnabled();
  const syncedRef = useRef(false);

  // 1) Hydrate from localStorage once on mount (both modes — instant UI).
  useEffect(() => {
    setUser(read<Account | null>(K_USER, null));
    const unlocked = read<string[]>(K_UNLOCKED, []);
    setUnlockedCourses(unlocked.includes(FREE_PART) ? unlocked : [FREE_PART, ...unlocked]);
    setCompleted(read<string[]>(K_COMPLETED, []));
    setHydrated(true);
  }, []);

  // 2) Cloud mode: track the Supabase session and pull server state.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    const applySession = async (sessionUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) => {
      if (!sessionUser) {
        syncedRef.current = false;
        setUser(null);
        return;
      }
      const account: Account = {
        id: sessionUser.id,
        email: sessionUser.email ?? "",
        name: (sessionUser.user_metadata?.name as string) || undefined,
      };
      setUser(account);

      if (syncedRef.current) return;
      syncedRef.current = true;

      // Pull entitlements + progress from the server.
      const [{ data: ents }, { data: prog }] = await Promise.all([
        sb.from("entitlements").select("course_id"),
        sb.from("progress").select("lesson_id"),
      ]);
      const serverUnlocked = (ents ?? []).map((e: { course_id: string }) => e.course_id);
      const serverDone = (prog ?? []).map((p: { lesson_id: string }) => p.lesson_id);

      // Migrate any pre-login local progress up to the server (union merge).
      const localDone = read<string[]>(K_COMPLETED, []);
      const missing = localDone.filter((id) => !serverDone.includes(id));
      if (missing.length) {
        await sb.from("progress").upsert(
          missing.map((lesson_id) => ({ user_id: sessionUser.id, lesson_id })),
          { onConflict: "user_id,lesson_id" }
        );
      }

      setUnlockedCourses((prev) => Array.from(new Set([FREE_PART, ...prev, ...serverUnlocked])));
      setCompleted(Array.from(new Set([...localDone, ...serverDone])));
    };

    sb.auth.getSession().then(({ data }) => applySession(data.session?.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 3) Persist to localStorage on change (cache in cloud mode, store in local mode).
  useEffect(() => {
    if (hydrated) write(K_USER, user);
  }, [user, hydrated]);
  useEffect(() => {
    if (hydrated) write(K_UNLOCKED, unlockedCourses);
  }, [unlockedCourses, hydrated]);
  useEffect(() => {
    if (hydrated) write(K_COMPLETED, completed);
  }, [completed, hydrated]);

  // --- auth ---
  const login = useCallback((email: string, name?: string) => setUser({ email, name }), []);

  const sendMagicLink = useCallback(async (email: string): Promise<{ ok: boolean; error?: string }> => {
    const sb = getSupabase();
    if (!sb) {
      // Local fallback: "log in" immediately with just the email.
      setUser({ email });
      return { ok: true };
    }
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/my-courses` : undefined },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }, []);

  const logout = useCallback(() => {
    const sb = getSupabase();
    if (sb) sb.auth.signOut();
    syncedRef.current = false;
    setUser(null);
  }, []);

  // --- entitlements ---
  // Server-authoritative in cloud mode (Stripe webhook / manual grants write the
  // table); the local unlock keeps the mock checkout flow working everywhere.
  const unlockCourse = useCallback(
    (courseId: string) => setUnlockedCourses((prev) => (prev.includes(courseId) ? prev : [...prev, courseId])),
    []
  );
  const isUnlocked = useCallback(
    (courseId: string) => courseId === FREE_PART || unlockedCourses.includes(courseId),
    [unlockedCourses]
  );

  // --- progress ---
  const toggleComplete = useCallback(
    (lessonId: string) => {
      setCompleted((prev) => {
        const marking = !prev.includes(lessonId);
        const sb = getSupabase();
        if (sb && user?.id) {
          if (marking) {
            sb.from("progress")
              .upsert({ user_id: user.id, lesson_id: lessonId }, { onConflict: "user_id,lesson_id" })
              .then(undefined, () => {});
          } else {
            sb.from("progress")
              .delete()
              .match({ user_id: user.id, lesson_id: lessonId })
              .then(undefined, () => {});
          }
        }
        return marking ? [...prev, lessonId] : prev.filter((l) => l !== lessonId);
      });
    },
    [user?.id]
  );
  const isComplete = useCallback((lessonId: string) => completed.includes(lessonId), [completed]);
  const completedCount = useCallback(
    (lessonIds: string[]) => lessonIds.filter((id) => completed.includes(id)).length,
    [completed]
  );

  return (
    <UserContext.Provider
      value={{
        user,
        cloudAuth,
        login,
        sendMagicLink,
        logout,
        unlockedCourses,
        unlockCourse,
        isUnlocked,
        completed,
        toggleComplete,
        isComplete,
        completedCount,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
