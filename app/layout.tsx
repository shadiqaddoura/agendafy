import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
