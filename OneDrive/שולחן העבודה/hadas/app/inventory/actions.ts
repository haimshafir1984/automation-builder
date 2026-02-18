"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function toNumber(value: FormDataEntryValue | null) {
  if (value === null) return NaN;
  return Number(value);
}

export async function createProduct(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const sku = String(formData.get("sku") || "").trim();
  const maxStock = toNumber(formData.get("maxStock"));
  const initialStock = toNumber(formData.get("initialStock"));

  if (!name || !sku || !Number.isFinite(maxStock) || maxStock <= 0) {
    throw new Error("Invalid product input");
  }

  const initial = Number.isFinite(initialStock) && initialStock > 0 ? initialStock : 0;

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name,
        sku,
        maxStock,
        currentStock: initial
      }
    });

    if (initial > 0) {
      await tx.inventoryTransaction.create({
        data: {
          productId: product.id,
          quantity: initial,
          type: "IN"
        }
      });
    }
  });

  revalidatePath("/inventory");
}

export async function addStock(formData: FormData) {
  const productId = toNumber(formData.get("productId"));
  const quantity = toNumber(formData.get("quantity"));

  if (!Number.isFinite(productId) || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Invalid stock input");
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: productId },
      data: {
        currentStock: {
          increment: quantity
        }
      }
    });

    await tx.inventoryTransaction.create({
      data: {
        productId,
        quantity,
        type: "IN"
      }
    });
  });

  revalidatePath("/inventory");
}

export async function recordSale(formData: FormData) {
  const productId = toNumber(formData.get("productId"));
  const quantity = toNumber(formData.get("quantity"));

  if (!Number.isFinite(productId) || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Invalid sale input");
  }

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId }
    });

    if (!product || product.currentStock - quantity < 0) {
      throw new Error("Insufficient stock");
    }

    await tx.product.update({
      where: { id: productId },
      data: {
        currentStock: {
          decrement: quantity
        }
      }
    });

    await tx.inventoryTransaction.create({
      data: {
        productId,
        quantity,
        type: "OUT"
      }
    });
  });

  revalidatePath("/inventory");
}

