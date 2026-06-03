import type { Metadata } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const metadata = {
  title: "Finance Planner", // household側は "Household Book"
  description: "PWA app",
  manifest: "/manifest.webmanifest",
  themeColor: "#0f172a", // household側は "#6b4f2a"
  appleWebApp: {
    capable: true,
    title: "Finance Planner", // household側は "Household Book"
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}
      <PwaRegister />
      </body>
    </html>
  );
}
