import { prisma } from "@/lib/prisma";

export function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export async function getEmployeeMonthlyStats(employeeId: number) {
  const { start, end } = getMonthRange();

  const [sales, shifts] = await Promise.all([
    prisma.sale.findMany({
      where: {
        employeeId,
        date: {
          gte: start,
          lt: end
        }
      }
    }),
    prisma.shift.findMany({
      where: {
        employeeId,
        date: {
          gte: start,
          lt: end
        }
      }
    })
  ]);

  const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const monthlyBonus = sales.reduce(
    (sum, sale) => sum + sale.amount * (sale.bonusRate / 100),
    0
  );
  const totalShifts = shifts.length;

  return {
    totalSales,
    monthlyBonus,
    totalShifts
  };
}

