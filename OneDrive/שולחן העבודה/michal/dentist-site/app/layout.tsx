import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "ד״ר בני פרדמן | מומחה לשיקום הפה בהרצליה",
  description:
    "שיקום פה מורכב ואסתטיקה דנטלית בהרצליה, עם תכנון דיגיטלי מתקדם, פתרונות למקרים מורכבים וליווי אישי רגוע לאורך כל התהליך."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen">
        <Navbar />
        <main className="relative">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
