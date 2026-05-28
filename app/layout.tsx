import type { Metadata } from "next";
import { Playpen_Sans } from "next/font/google";
import "./globals.css";

const playpenSans = Playpen_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-task",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agendafy — Editorial",
  description: "A notebook-style daily planner for tasks, quick notes, and goals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${playpenSans.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
