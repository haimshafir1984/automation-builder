import { getSiteContent } from "@/lib/site-content";
import NavbarClient from "@/components/NavbarClient";

export default async function Navbar() {
  const content = await getSiteContent();
  const { shared } = content;

  return <NavbarClient shared={shared} />;
}
