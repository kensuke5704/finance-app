import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./workspace.css";
import PwaRegister from "../components/PwaRegister";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Finance App",
  description: "Finance management app",
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "Finance App", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: `${basePath}/icons/icon.svg`, type: "image/svg+xml" },
      { url: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: `${basePath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#03122d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
