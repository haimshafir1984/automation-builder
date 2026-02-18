"use client";

import { ReactNode, createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

type TabsProps = {
  defaultValue: string;
  children: ReactNode;
};

export function Tabs({ defaultValue, children }: TabsProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className="space-y-4">{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children
}: {
  value: string;
  children: ReactNode;
}) {
  const context = useContext(TabsContext);
  if (!context) return null;

  const isActive = context.value === value;
  return (
    <button
      type="button"
      onClick={() => context.setValue(value)}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-medium transition",
        isActive
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:text-slate-900"
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children
}: {
  value: string;
  children: ReactNode;
}) {
  const context = useContext(TabsContext);
  if (!context || context.value !== value) return null;
  return <div className="space-y-4">{children}</div>;
}

