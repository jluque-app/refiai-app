import { redirect } from 'next/navigation';
import courseData from '@/content/course.json';

export default function CourseIndex() {
    if (courseData.parts && courseData.parts.length > 0) {
        redirect(`/course/${courseData.parts[0].id}`);
    }

    return (
        <div className="flex items-center justify-center h-screen">
            <p className="text-muted-foreground">No course content found.</p>
        </div>
    );
}
