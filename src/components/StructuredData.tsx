import courseDataRaw from "@/content/course.json";
import { CourseData } from "@/types/course";

/**
 * JSON-LD structured data for SEO (Organization + Course schema).
 * Helps Google show course rich results and understand the site. Rendered on
 * marketing pages. Update SITE/sameAs/logo when the brand/domain finalise.
 */
const SITE = "https://refiai.allretech.org";
const course = courseDataRaw as CourseData;

export default function StructuredData() {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ReFiAI",
    url: SITE,
    description: "Real estate finance and investment education with interactive labs, problem sets, videos and an AI tutor.",
    logo: `${SITE}/og-image.jpg`,
  };

  const courses = course.parts.map((part) => ({
    "@context": "https://schema.org",
    "@type": "Course",
    name: `ReFiAI — ${part.title}`,
    description: part.description,
    provider: { "@type": "Organization", name: "ReFiAI", url: SITE },
    url: `${SITE}/course/${part.id}`,
    inLanguage: "en",
    ...(part.price > 0
      ? {
          offers: {
            "@type": "Offer",
            price: part.price,
            priceCurrency: "EUR",
            category: "Paid",
            availability: "https://schema.org/InStock",
          },
        }
      : {
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: 0, priceCurrency: "EUR", category: "Free" },
        }),
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: `PT${part.units.reduce((n, u) => n + u.lessons.length, 0)}H`,
    },
  }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />
      {courses.map((c, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(c) }} />
      ))}
    </>
  );
}
