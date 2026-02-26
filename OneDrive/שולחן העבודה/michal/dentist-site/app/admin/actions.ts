"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function enableAdminMode() {
  const cookieStore = await cookies();
  cookieStore.set("admin_mode", "1", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 12
  });
  redirect("/admin/content");
}

export async function disableAdminMode() {
  const cookieStore = await cookies();
  cookieStore.set("admin_mode", "0", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 0
  });
  redirect("/");
}
