import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Header from "../components/Header";
import { NotificationProvider } from "../components/NotificationContext";
import NotificationPopup from "../components/NotificationPopup";

export const metadata: Metadata = {
  title: "Escroway | Telegram Escrow Service",
  description:
    "Secure Telegram escrow service with admin dashboard and role management.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="bg-gray-50 min-h-screen antialiased">
        <NotificationProvider>
          <Header />
          <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
          <NotificationPopup />
        </NotificationProvider>
      </body>
    </html>
  );
}
