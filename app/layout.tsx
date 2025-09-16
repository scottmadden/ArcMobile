import "./globals.css";
import type { Metadata } from "next";
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
            <a className="font-bold" href="/">ArcMobile</a>
            <nav className="hidden md:flex gap-4 text-sm">
              <a className="hover:underline" href="/assignments">Assignments</a>
              <a className="hover:underline" href="/checklist">Checklist</a>
              <a className="hover:underline" href="/documents">Documents</a>
              <a className="hover:underline" href="/audit">Audit</a>
              <a className="hover:underline" href="/analytics">Analytics</a>
              <a className="hover:underline" href="/setup">Setup</a>
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
