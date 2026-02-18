import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getEmployeeMonthlyStats } from "@/lib/employee";
import { createEmployee, logSale, logShift } from "./actions";
import { Activity, TrendingUp, Wallet } from "lucide-react";

type EmployeesPageProps = {
  searchParams?: { employeeId?: string };
};

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  const employees = await prisma.employee.findMany({
    orderBy: { name: "asc" }
  });

  const selectedId = Number(searchParams?.employeeId || employees[0]?.id);
  const selectedEmployee = employees.find((employee) => employee.id === selectedId);
  const stats = selectedEmployee
    ? await getEmployeeMonthlyStats(selectedEmployee.id)
    : null;

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">ניהול עובדים</h1>
        <p className="text-slate-500">
          ניהול מכירות, בונוסים ומשמרות לעובדים.
        </p>
      </header>

      <Tabs defaultValue="admin">
        <TabsList>
          <TabsTrigger value="admin">הזנת נתונים</TabsTrigger>
          <TabsTrigger value="view">תצוגת משתמש</TabsTrigger>
        </TabsList>

        <TabsContent value="admin">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="text-lg font-semibold text-slate-900">
                הוספה חדשה
              </h2>
              <form action={createEmployee} className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="name">שם מלא</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeCode">מספר עובד</Label>
                  <Input id="employeeCode" name="employeeCode" required />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="hourlyRate">שכר לשעה</Label>
                    <Input id="hourlyRate" name="hourlyRate" type="number" min="0" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salesTarget">יעד מכירות</Label>
                    <Input id="salesTarget" name="salesTarget" type="number" min="0" required />
                  </div>
                </div>
                <Button type="submit">שמירת עובד</Button>
              </form>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-slate-900">
                מכירות ומשמרות
              </h2>
              <div className="mt-4 grid gap-4">
                <form action={logSale} className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-600">
                    רישום מכירה (כולל אחוז בונוס)
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="saleEmployee">עובד</Label>
                    <select
                      id="saleEmployee"
                      name="employeeId"
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm"
                      required
                    >
                      <option value="">בחר</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name} ({employee.employeeCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="amount">סכום מכירה</Label>
                      <Input id="amount" name="amount" type="number" min="1" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bonusRate">אחוז בונוס</Label>
                      <Input id="bonusRate" name="bonusRate" type="number" min="0" step="0.1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="saleDate">תאריך</Label>
                    <Input id="saleDate" name="date" type="date" />
                  </div>
                  <Button type="submit" variant="secondary">
                    שמור מכירה
                  </Button>
                </form>

                <form action={logShift} className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-600">
                    רישום משמרת
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="shiftEmployee">עובד</Label>
                    <select
                      id="shiftEmployee"
                      name="employeeId"
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm"
                      required
                    >
                      <option value="">בחר</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name} ({employee.employeeCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="hours">שעות</Label>
                      <Input id="hours" name="hours" type="number" min="1" step="0.5" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shiftDate">תאריך</Label>
                      <Input id="shiftDate" name="date" type="date" />
                    </div>
                  </div>
                  <Button type="submit" variant="outline">
                    שמור משמרת
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="view">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">
              דשבורד עובד
            </h2>
            <form method="get" className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
              <div className="space-y-2">
                <Label htmlFor="employeeSelect">עובד</Label>
                <select
                  id="employeeSelect"
                  name="employeeId"
                  defaultValue={selectedEmployee?.id ?? ""}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm"
                >
                  {employees.length === 0 && <option value="">אין עובדים</option>}
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit">טען דשבורד</Button>
            </form>

            {stats ? (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <p className="text-xs uppercase">בונוס חודשי</p>
                    <Wallet size={16} />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-emerald-600">
                    ₪{stats.monthlyBonus.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <p className="text-xs uppercase">מכירות החודש</p>
                    <TrendingUp size={16} />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-emerald-600">
                    ₪{stats.totalSales.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <p className="text-xs uppercase">סה״כ משמרות</p>
                    <Activity size={16} />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {stats.totalShifts}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                אין עובדים להצגה. הוסף עובד במקטע הניהול.
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

