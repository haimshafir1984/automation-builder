import { Product } from "@prisma/client";

export function lowStockThreshold(maxStock: number) {
  return Math.max(1, Math.ceil(maxStock * 0.1));
}

export function isLowStock(product: Pick<Product, "currentStock" | "maxStock">) {
  return product.currentStock < lowStockThreshold(product.maxStock);
}

