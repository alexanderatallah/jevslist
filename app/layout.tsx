import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jevslist",
  description: "Bring your favorites. Let Jev put them in order. Public collections of interesting things, ranked by Jev.",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
