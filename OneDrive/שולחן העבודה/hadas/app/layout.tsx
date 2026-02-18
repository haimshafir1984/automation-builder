import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "sonner";
import { Heebo } from "next/font/google";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "מערכת ניהול קמעונאית",
  description: "מערכת ניהול לעובדים ומנהלים בחנות"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.className} min-h-screen bg-slate-50 text-slate-900`}>
        <div className="flex min-h-screen">
          <main className="flex-1 p-6 md:p-10">
            <div className="mx-auto w-full max-w-6xl space-y-6">
              {children}
            </div>
          </main>
          <div className="hidden md:block">
            <Sidebar />
          </div>
        </div>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

