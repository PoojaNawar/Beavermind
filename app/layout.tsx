import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans-loaded",
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
    <html lang="en" className={sans.variable}>
      <body className="font-sans antialiased">
        <div className="min-h-screen">
          <header className="border-b border-[var(--line)] bg-[var(--card)]">
            <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-3.5">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--ink)] text-[11px] font-bold tracking-tight text-white">
                  BM
                </span>
                <span className="text-[15px] font-semibold tracking-tight">
                  BeaverMind
                </span>
              </Link>
              <Link
                href="/#history"
                className="text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              >
                History
              </Link>
            </div>
          </header>
          <main className="mx-auto max-w-[1180px] px-5 py-10 sm:py-14">{children}</main>
        </div>
      </body>
    </html>
  );
}
