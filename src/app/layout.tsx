import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReFiAI | Real Estate Finance & AI Training",
  description: "Master Real Estate Financial Modeling with AI-enhanced curriculum. From basic proformas to advanced REIT analysis.",
  openGraph: {
    title: "ReFiAI | Future of Real Estate Education",
    description: "Learn Real Estate Finance faster with AI.",
    images: ["/og-image.jpg"],
  },
};

import { UserProvider } from "@/components/UserContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
