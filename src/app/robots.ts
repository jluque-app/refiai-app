import { MetadataRoute } from "next";

const SITE = "https://refiai.allretech.org";

/**
 * Search engines (Googlebot, Bingbot…) may index the site — that's our SEO.
 * AI-TRAINING and AI-scraper crawlers are told to stay out entirely, so course
 * material isn't hoovered into training sets or answer engines.
 * (robots.txt is honored by the major operators; it is a deterrent, not a wall.)
 */
const AI_CRAWLERS = [
  "GPTBot",            // OpenAI training
  "ChatGPT-User",      // ChatGPT browsing
  "OAI-SearchBot",     // OpenAI search
  "ClaudeBot",         // Anthropic crawler
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "Google-Extended",   // Gemini training (does NOT affect Google Search indexing)
  "CCBot",             // Common Crawl (feeds many training sets)
  "PerplexityBot",
  "Perplexity-User",
  "Bytespider",        // ByteDance
  "meta-externalagent",
  "FacebookBot",
  "Amazonbot",
  "cohere-ai",
  "Diffbot",
  "omgili",
  "TimpiBot",
  "AI2Bot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, disallow: "/" })),
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
