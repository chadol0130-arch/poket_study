import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "포켓몬 숙제 트래커",
  description: "숙제를 제출하고 검사받으면 포켓몬이 성장하는 학습 동기부여 시스템",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "포켓몬 숙제" },
};

export const viewport: Viewport = {
  themeColor: "#ef5350",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
