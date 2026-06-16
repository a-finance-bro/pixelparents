"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Parents" },
  { href: "/admin/children", label: "Children" },
  { href: "/admin/api-requests", label: "API Requests" },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const active =
          it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-white/10 font-semibold text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
