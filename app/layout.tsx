import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ArcMobile",
  description: "Food-truck compliance made simple.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
/* in the <nav> ... add: */
<a className="hover:underline" href="/assignments">Assignments</a>

      <body className="bg-[#F7F9FC] text-[#1F2937]">{children}</body>
    </html>
  );
}
