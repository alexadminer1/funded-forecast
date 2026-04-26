import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FundedForecast — Prediction Markets",
  description: "Skill-based forecasting challenges with real payouts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ margin: 0, background: "#0F172A", color: "#F8FAFC" }}>
        <Header />
        {children}
      </body>
    </html>
  );
}
