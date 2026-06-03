import type { Metadata } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "Finance App",
  description: "Finance management app",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Finance App",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}