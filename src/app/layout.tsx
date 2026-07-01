import type { Metadata } from "next";
import "../styles/globals.css";
import { UserProvider } from "@/components/UserContext";

// NOTE: We intentionally do NOT use next/font/google here.
// Fetching Geist from Google Fonts at first render can hang the dev server on
// restricted / corporate networks (e.g. university VPNs), which looks like the
// page "never loads". We bind the same CSS variables to a robust system-font
// stack instead, so the app renders instantly everywhere with no network call.
const fontVars = {
  "--font-geist-sans":
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  "--font-geist-mono":
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as React.CSSProperties;

const SITE_URL = "https://refiai.allretech.org";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ReFiAI — Real Estate Finance & Investment, taught with AI",
    template: "%s | ReFiAI",
  },
  description:
    "Learn real estate finance and investment with interactive Excel labs, worked problem sets, video lessons and an AI tutor. From proformas, cap rates and DCF to mortgages, capital structures, REITs and development finance.",
  keywords: [
    "real estate finance",
    "real estate investment course",
    "real estate financial modeling",
    "cap rate",
    "DCF valuation",
    "commercial mortgages",
    "REITs",
    "real estate development finance",
    "proforma",
    "online real estate course",
  ],
  authors: [{ name: "Prof. Jaime Luque" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "ReFiAI",
    title: "ReFiAI — Real Estate Finance & Investment, taught with AI",
    description:
      "Interactive labs, worked problem sets, video lessons and an AI tutor for real estate finance — from proformas to REITs and development finance.",
    images: ["/og-image.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ReFiAI — Real Estate Finance & Investment, taught with AI",
    description: "Interactive real estate finance course: Excel labs, problem sets, videos and an AI tutor.",
    images: ["/og-image.jpg"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* No-flash theme: light by default; apply saved dark choice before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('refiai_theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();",
          }}
        />
      </head>
      <body style={fontVars}>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
