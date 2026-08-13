import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: {
    default: "Bella Cucina — Wood-fired Italian",
    template: "%s · Bella Cucina",
  },
  description:
    "Order wood-fired pizza, fresh pasta and Italian classics for dine-in, takeaway or delivery.",
  applicationName: "Bella Cucina",
};

export const viewport: Viewport = {
  themeColor: "#8B1E1E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            classNames: {
              toast: "rounded-xl border border-cream-400",
            },
          }}
        />
      </body>
    </html>
  );
}
