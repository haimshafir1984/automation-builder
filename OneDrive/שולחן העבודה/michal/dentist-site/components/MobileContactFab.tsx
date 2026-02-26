import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { getSiteContent } from "@/lib/site-content";

export default async function MobileContactFab() {
  const {
    shared: { phone, whatsapp }
  } = await getSiteContent();
  const whatsappLink = whatsapp
    ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`
    : null;
  const href = whatsappLink || `tel:${phone}`;

  return (
    <Link
      href={href}
      target={whatsappLink ? "_blank" : undefined}
      rel={whatsappLink ? "noreferrer" : undefined}
      aria-label="יצירת קשר מהיר"
      className="md:hidden fixed bottom-4 right-4 z-40 inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-[var(--accent-color)] text-white shadow-lg transition duration-300 hover:scale-105"
    >
      <MessageCircle size={20} />
    </Link>
  );
}
