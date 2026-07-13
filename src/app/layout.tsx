import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FCV TADA | Today's Deputation",
  description: "Daily engineer deputation planning module"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
