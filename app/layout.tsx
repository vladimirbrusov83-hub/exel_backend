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
  // Added to the home screen it opens without the browser chrome and with a
  // dark status bar, which is how clients actually use it in the gym.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Training" },
};

export const viewport: Viewport = {
  themeColor: "#1b1c22",
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
