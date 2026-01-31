"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface UserContextType {
    unlockedCourses: string[];
    unlockCourse: (courseId: string) => void;
    isUnlocked: (courseId: string) => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [unlockedCourses, setUnlockedCourses] = useState<string[]>([]);

    // Initialize with Part 1 (Free) unlocked by default
    useEffect(() => {
        setUnlockedCourses((prev) => {
            if (!prev.includes("part-1")) return [...prev, "part-1"];
            return prev;
        });
    }, []);

    const unlockCourse = (courseId: string) => {
        setUnlockedCourses((prev) => [...prev, courseId]);
    };

    const isUnlocked = (courseId: string) => unlockedCourses.includes(courseId);

    return (
        <UserContext.Provider value={{ unlockedCourses, unlockCourse, isUnlocked }}>
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
