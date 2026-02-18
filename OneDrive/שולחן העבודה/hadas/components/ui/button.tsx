import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline";
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "default" &&
          "bg-action text-action-foreground hover:bg-indigo-600",
        variant === "secondary" &&
          "bg-slate-100 text-slate-900 hover:bg-slate-200",
        variant === "outline" &&
          "border border-slate-300 bg-transparent text-slate-900 hover:bg-slate-100",
        className
      )}
      {...props}
    />
  );
}

