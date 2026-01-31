import { CourseList } from "@/components/CourseList";

export default function MyCourses() {
    return (
        <div>
            <h1 className="text-3xl font-bold mb-8">My Enrolled Courses</h1>
            <CourseList />
        </div>
    );
}
