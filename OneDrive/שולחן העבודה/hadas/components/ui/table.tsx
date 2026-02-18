import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type TableProps = HTMLAttributes<HTMLTableElement>;

export function Table({ className, ...props }: TableProps) {
  return (
    <table
      className={cn("w-full border-collapse text-sm", className)}
      {...props}
    />
  );
}

