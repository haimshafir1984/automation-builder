"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function toNumber(value: FormDataEntryValue | null) {
  if (value === null) return NaN;
  return Number(value);
}

function toDate(value: FormDataEntryValue | null) {
  if (!value) return new Date();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function createEmployee(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const employeeCode = String(formData.get("employeeCode") || "").trim();
  const hourlyRate = toNumber(formData.get("hourlyRate"));
  const salesTarget = toNumber(formData.get("salesTarget"));

  if (!name || !employeeCode || !Number.isFinite(hourlyRate) || !Number.isFinite(salesTarget)) {
    throw new Error("Invalid employee input");
  }

  await prisma.employee.create({
    data: {
      name,
      employeeCode,
      hourlyRate,
      salesTarget
    }
  });

  revalidatePath("/employees");
}

export async function logSale(formData: FormData) {
  const employeeId = toNumber(formData.get("employeeId"));
  const amount = toNumber(formData.get("amount"));
  const bonusRate = toNumber(formData.get("bonusRate"));
  const date = toDate(formData.get("date"));

  if (!Number.isFinite(employeeId) || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid sale input");
  }

  const bonus = Number.isFinite(bonusRate) && bonusRate >= 0 ? bonusRate : 0;

  await prisma.sale.create({
    data: {
      employeeId,
      amount,
      bonusRate: bonus,
      date
    }
  });

  revalidatePath("/employees");
}

export async function logShift(formData: FormData) {
  const employeeId = toNumber(formData.get("employeeId"));
  const hours = toNumber(formData.get("hours"));
  const date = toDate(formData.get("date"));

  if (!Number.isFinite(employeeId) || !Number.isFinite(hours) || hours <= 0) {
    throw new Error("Invalid shift input");
  }

  await prisma.shift.create({
    data: {
      employeeId,
      hours,
      date
    }
  });

  revalidatePath("/employees");
}

