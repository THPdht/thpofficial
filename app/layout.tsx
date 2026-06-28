import type { Metadata } from "next";
import { Holtwood_One_SC, Libre_Franklin, DM_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/ui/Nav";
import { Footer } from "@/components/ui/Footer";

const holtwood = Holtwood_One_SC({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const franklin = Libre_Franklin({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-mono",
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "THP — The Hormone Prophet",
  description:
    "Rebuild your hormones, physique, and energy from the ground up. A biological transformation system built on bloodwork, metabolism, and human chemistry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${holtwood.variable} ${franklin.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-white font-body">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
