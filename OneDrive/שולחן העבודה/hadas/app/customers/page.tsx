import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { createCustomer } from "./actions";
import { CustomerBroadcast } from "@/components/customer-broadcast";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { joinedAt: "desc" }
  });

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">מועדון לקוחות</h1>
        <p className="text-slate-500">
          הרשמה למועדון לקוחות ושליחת הודעות שיווק.
        </p>
      </header>

      <Tabs defaultValue="admin">
        <TabsList>
          <TabsTrigger value="admin">הזנת נתונים</TabsTrigger>
          <TabsTrigger value="view">תצוגת משתמש</TabsTrigger>
        </TabsList>

        <TabsContent value="admin">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">
              הוספה חדשה
            </h2>
            <form action={createCustomer} className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="name">שם מלא</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">טלפון</Label>
                <Input id="phone" name="phone" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">אימייל</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <Button type="submit">שמירת לקוח</Button>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="view">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="text-lg font-semibold text-slate-900">
                שידור ללקוחות
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                שליחת הודעה לכל לקוחות המועדון (סימולציה).
              </p>
              <div className="mt-4">
                <CustomerBroadcast />
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-slate-900">
                רשימת לקוחות
              </h2>
              <div className="mt-4 overflow-x-auto">
                <Table>
                  <thead className="border-b border-slate-200 text-left text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">שם</th>
                      <th className="py-2 pr-4">טלפון</th>
                      <th className="py-2 pr-4">אימייל</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.id} className="border-b border-slate-100 text-slate-700">
                        <td className="py-2 pr-4 font-medium text-slate-900">{customer.name}</td>
                        <td className="py-2 pr-4">{customer.phone}</td>
                        <td className="py-2 pr-4">{customer.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {customers.length === 0 && (
                  <p className="mt-4 text-sm text-slate-500">
                    עדיין אין לקוחות רשומים.
                  </p>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

