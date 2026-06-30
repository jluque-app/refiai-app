"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

/**
 * UserContext — the client-side account, entitlement and progress store.
 *
 * For now this persists to localStorage so the experience is real end-to-end
 * (sign in, buy a module, track progress) WITHOUT a backend. The shape is
 * deliberately backend-ready: replace the localStorage reads/writes with API
 * calls to your DB + Stripe webhook (entitlements) and a progress table, and
 * nothing else in the UI has to change.
 */

interface Account {
  email: string;
  name?: string;
}

interface UserContextType {
  // auth
  user: Account | null;
  login: (email: string, name?: string) => void;
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

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    setUser(read<Account | null>(K_USER, null));
    const unlocked = read<string[]>(K_UNLOCKED, []);
    setUnlockedCourses(unlocked.includes(FREE_PART) ? unlocked : [FREE_PART, ...unlocked]);
    setCompleted(read<string[]>(K_COMPLETED, []));
    setHydrated(true);
  }, []);

  // Persist on change (after hydration, so we don't clobber stored values).
  useEffect(() => {
    if (hydrated) write(K_USER, user);
  }, [user, hydrated]);
  useEffect(() => {
    if (hydrated) write(K_UNLOCKED, unlockedCourses);
  }, [unlockedCourses, hydrated]);
  useEffect(() => {
    if (hydrated) write(K_COMPLETED, completed);
  }, [completed, hydrated]);

  const login = useCallback((email: string, name?: string) => setUser({ email, name }), []);
  const logout = useCallback(() => setUser(null), []);

  const unlockCourse = useCallback(
    (courseId: string) => setUnlockedCourses((prev) => (prev.includes(courseId) ? prev : [...prev, courseId])),
    []
  );
  const isUnlocked = useCallback((courseId: string) => courseId === FREE_PART || unlockedCourses.includes(courseId), [unlockedCourses]);

  const toggleComplete = useCallback(
    (lessonId: string) =>
      setCompleted((prev) => (prev.includes(lessonId) ? prev.filter((l) => l !== lessonId) : [...prev, lessonId])),
    []
  );
  const isComplete = useCallback((lessonId: string) => completed.includes(lessonId), [completed]);
  const completedCount = useCallback(
    (lessonIds: string[]) => lessonIds.filter((id) => completed.includes(id)).length,
    [completed]
  );

  return (
    <UserContext.Provider
      value={{ user, login, logout, unlockedCourses, unlockCourse, isUnlocked, completed, toggleComplete, isComplete, completedCount }}
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
