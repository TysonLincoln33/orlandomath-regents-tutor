import type { Metadata } from "next";
import "./globals.css";
import HeaderBehavior from "@/components/HeaderBehavior";
import TopNav from "@/components/chrome/TopNav";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://regents-tutor.net"),
  title: "OrlandoMath Regents Tutor",
  description: "A clean, colorful Regents-aligned Algebra 1 course dashboard with progress tracking.",
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <HeaderBehavior />
        <TopNav />
        <main className="om-page">{children}</main>
      </body>
    </html>
  );
}
