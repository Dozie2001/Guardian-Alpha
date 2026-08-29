import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guardian MCP",
  description: "Policy-bounded AI trading gateway for Alpaca paper trading."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
