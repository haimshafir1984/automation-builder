"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CustomerBroadcast() {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("יש להזין הודעה לפני שליחה.");
      return;
    }

    console.log("שידור לכל הלקוחות:", message);
    toast.success("ההודעה נשלחה לכל הלקוחות (סימולציה).");
    setMessage("");
  };

  return (
    <div className="space-y-3">
      <textarea
        className="min-h-[140px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm"
        placeholder="כתוב כאן הודעת שיווק..."
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <Button type="button" onClick={handleSend}>
        שלח לכל הלקוחות
      </Button>
    </div>
  );
}

