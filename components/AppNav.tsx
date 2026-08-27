"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Evaluate" },
  { href: "/history", label: "History" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1" aria-label="Primary">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "rounded-lg px-3 py-1.5 text-sm font-semibold text-[var(--ink)]"
                : "rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--accent-soft)]/60 hover:text-[var(--ink)]"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
