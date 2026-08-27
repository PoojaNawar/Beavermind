import type { Metadata } from "next";
import Link from "next/link";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans-loaded",
  weight: ["400", "500", "600", "700"],
});

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display-loaded",
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
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        <div className="app-shell min-h-screen">
          <header className="sticky top-0 z-20 border-b border-[var(--line)]/80 bg-[var(--card)]/85 backdrop-blur-md">
            <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-3.5">
              <Link href="/" className="group flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--accent)] text-[12px] font-bold tracking-tight text-[var(--card)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition group-hover:bg-[var(--ink)]"
                  aria-hidden
                >
                  B
                </span>
                <span className="font-display text-[18px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  BeaverMind
                </span>
              </Link>
              <AppNav />
            </div>
          </header>
          <main className="mx-auto max-w-[1180px] px-5 py-10 sm:py-14">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
