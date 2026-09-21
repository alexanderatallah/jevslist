import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jevslist",
  description: "Jev's favorite things, submitted by you",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
