import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrewLite · Đơn hàng của bạn",
  description:
    "Đặt cà phê, theo dõi đơn hàng và nhận đồ uống tại quầy BrewLite.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
