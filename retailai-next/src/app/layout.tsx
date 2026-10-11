import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import "./staff-rider.css";

export const metadata: Metadata = {
  title: "RetailAI — AI Voice Ordering",
  description: "RetailAI — AI voice ordering that is fast, smart and effortless.",
  authors: [{ name: "RetailAI" }],
  openGraph: {
    title: "RetailAI — AI Voice Ordering",
    description: "RetailAI — AI voice ordering that is fast, smart and effortless.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
