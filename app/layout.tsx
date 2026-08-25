import type { Metadata } from "next";
import Link from "next/link";
import { Source_Sans_3, Syne } from "next/font/google";
import "./globals.css";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["500", "600", "700"],
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BeaverMind Call Evaluator",
  description:
    "Rubric-driven coaching and kick-off call evaluation with evidence-backed scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} antialiased`}>
        <div className="min-h-screen">
          <header className="border-b border-[var(--line)]/80 bg-[var(--card)]/70 backdrop-blur-sm">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
              <Link href="/" className="group flex items-baseline gap-3">
                <span className="font-display text-xl font-semibold tracking-tight text-[var(--accent)]">
                  BeaverMind
                </span>
                <span className="text-sm text-[var(--muted)] group-hover:text-[var(--ink)]">
                  Call Quality Evaluation
                </span>
              </Link>
              <span className="hidden text-xs text-[var(--muted)] sm:inline">
                Evidence-first QC
              </span>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">{children}</main>
        </div>
      </body>
    </html>
  );
}
