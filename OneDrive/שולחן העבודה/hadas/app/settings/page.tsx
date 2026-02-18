import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-900">הגדרות</h1>
        <p className="text-slate-500">
          הגדרות מערכת וניהול מודולים עתידיים.
        </p>
      </header>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">
          בקרוב: הגדרות מתקדמות
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          כאן יתווספו הגדרות אינטגרציות והרשאות.
        </p>
      </Card>
    </>
  );
}

