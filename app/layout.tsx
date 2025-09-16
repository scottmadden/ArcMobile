import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ArcMobile",
  description: "Food-truck compliance made simple.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#F7F9FC] text-[#1F2937] min-h-screen">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur shadow-sm">
          <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
            <a href="/" className="font-bold text-[#004C97]">ArcMobile</a>
            <nav className="flex gap-4 text-sm">
              <a className="hover:underline" href="/checklist">Checklists</a>
              <a className="hover:underline" href="/documents">Documents</a>
              <a className="hover:underline" href="/reminders">Reminders</a>
              <a className="hover:underline" href="/assignments">Assignments</a>
              <a className="hover:underline" href="/audit">Audit</a>
              <a className="hover:underline" href="/analytics">Analytics</a>
              <a className="hover:underline" href="/setup">Setup</a>
              <a className="hover:underline" href="/login">Login</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
