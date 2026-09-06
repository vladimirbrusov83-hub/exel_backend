import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// There is no login here on purpose, so nothing should ever be crawled.
export const metadata: Metadata = {
  title: "Training program",
  robots: { index: false, follow: false },
  // Added to the home screen it opens without the browser chrome, which is how
  // clients actually use it in the gym. black-translucent is what makes iOS
  // hand the app the notch area, which the safe-area padding in globals.css
  // then pays for.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Training" },
};

export const viewport: Viewport = {
  // One per scheme, so the browser chrome above the page matches the page.
  // These are the two --background values in globals.css and have to be kept
  // in step with them by hand.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceef2" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1c22" },
  ],
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
