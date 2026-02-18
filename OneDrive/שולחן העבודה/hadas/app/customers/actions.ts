"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createCustomer(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();

  if (!name || !phone || !email) {
    throw new Error("Invalid customer input");
  }

  await prisma.customer.create({
    data: {
      name,
      phone,
      email
    }
  });

  revalidatePath("/customers");
}

