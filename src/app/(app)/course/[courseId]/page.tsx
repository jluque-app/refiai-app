"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import courseDataRaw from "@/content/course.json";
import { CourseData } from "@/types/course";

const courseData = courseDataRaw as CourseData;

export default function CourseRedirect() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.courseId as string;

    useEffect(() => {
        if (!courseId) return;

        const part = courseData.parts.find((p) => p.id === courseId);

        if (!part || !part.units.length || !part.units[0].lessons.length) {
            return; // Or redirect to 404
        }

        const firstUnit = part.units[0];
        const firstLesson = firstUnit.lessons[0];

        router.replace(`/course/${courseId}/lesson/${firstLesson.id}`);
    }, [courseId, router]);

    return (
        <div className="flex items-center justify-center h-screen">
            <span className="loading loading-spinner loading-lg"></span>
            Redirecting to first lesson...
        </div>
    );
}
