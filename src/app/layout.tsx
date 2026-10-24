import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "NordStone — Proposal desk", template: "%s · NordStone" },
  description: "Prepare tailored AI proposals using your company profile.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
