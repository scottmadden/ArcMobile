// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import MobileNav from "../components/MobileNav";

export const metadata: Metadata = {
  title: "ArcMobile",
  description: "Food-truck compliance made simple",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/dashboard" className="font-bold">ArcMobile</Link>
            <nav className="hidden md:flex gap-4 text-sm">
              <Link className="hover:underline" href="/assignments">Assignments</Link>
              <Link className="hover:underline" href="/checklist">Checklist</Link>
              <Link className="hover:underline" href="/documents">Documents</Link>
              <Link className="hover:underline" href="/audit">Audit</Link>
              <Link className="hover:underline" href="/analytics">Analytics</Link>
              <Link className="hover:underline" href="/setup">Setup</Link>
            </nav>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-4 page">
          {children}
        </main>

        <MobileNav />
      </body>
    </html>
  );
}
