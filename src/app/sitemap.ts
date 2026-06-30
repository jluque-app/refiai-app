import { MetadataRoute } from "next";
import courseDataRaw from "@/content/course.json";
import { CourseData } from "@/types/course";

const SITE = "https://refiai.allretech.org";
const course = courseDataRaw as CourseData;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/courses`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];

  // Every lesson is a crawlable page (free + preview lessons aid discovery).
  const lessonPages: MetadataRoute.Sitemap = course.parts.flatMap((part) =>
    part.units.flatMap((unit) =>
      unit.lessons.map((lesson) => ({
        url: `${SITE}/course/${part.id}/lesson/${lesson.id}`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: part.id === "part-1" || lesson.preview ? 0.7 : 0.4,
      }))
    )
  );

  return [...staticPages, ...lessonPages];
}
