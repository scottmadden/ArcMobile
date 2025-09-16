"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Home" },
  { href: "/assignments", label: "Assignments" },
  { href: "/checklist", label: "Checklist" },
  { href: "/documents", label: "Documents" },
  { href: "/audit", label: "Audit" },
];

export default function MobileNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden border-t bg-white/95 backdrop-blur z-50">
      <ul className="grid grid-cols-5 text-xs">
        {items.map((it) => {
          const active = path === it.href || path.startsWith(it.href + "/");
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex flex-col items-center justify-center py-2 ${active ? "text-primary" : "text-gray-600"}`}
              >
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
