import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "SheetAI Pro | The AI Companion for Your Spreadsheets",
  description: "Stop wrestling with complex formulas. Chat with your spreadsheets, generate instant charts, and clean data in seconds using natural language.",
};

import Script from "next/script";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </head>
      <body
        className={`${nunito.variable} font-sans antialiased bg-[#FAFAFA] text-slate-900 selection:bg-emerald-200 selection:text-emerald-900`}
      >
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: "1rem",
              fontFamily: "var(--font-nunito)",
            },
          }}
        />
      </body>
    </html>
  );
}

