import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Fraunces speaks — an old soul with sharp edges. Plex Mono reads the
// instruments. The contrast is the identity: ancient intelligence, future tech.
const voice = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["300", "400", "500"],
  variable: "--font-voice",
});

const data = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-data",
});

export const metadata: Metadata = {
  title: "LEVIATHAN",
  description: "A voice-driven agentic AI companion.",
};

export const viewport: Viewport = {
  themeColor: "#04080a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${voice.variable} ${data.variable}`}>
      <body>{children}</body>
    </html>
  );
}
