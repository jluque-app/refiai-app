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

export const metadata: Metadata = {
  title: "ReFiAI | Real Estate Finance & AI Training",
  description:
    "Master Real Estate Financial Modeling with AI-enhanced curriculum. From basic proformas to advanced REIT analysis.",
  openGraph: {
    title: "ReFiAI | Future of Real Estate Education",
    description: "Learn Real Estate Finance faster with AI.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={fontVars}>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
