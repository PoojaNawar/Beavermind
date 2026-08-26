"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "New evaluation" },
  { href: "/history", label: "History" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-5" aria-label="Primary">
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
                ? "text-sm font-semibold text-[var(--ink)]"
                : "text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
