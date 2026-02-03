import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout";

export const metadata: Metadata = {
  title: "AI Search Diagnostic | TechFlow",
  description: "AI Search Presence Diagnostic Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-[#0F1117] text-[#E5E7EB]">
        <Sidebar />
        {children}
      </body>
    </html>
  );
}
