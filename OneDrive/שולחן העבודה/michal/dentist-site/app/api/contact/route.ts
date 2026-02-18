import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

type Lead = {
  fullName: string;
  phone: string;
  email?: string;
  message: string;
  preferredTime?: string;
  createdAt: string;
  userAgent?: string;
};

function isValidPhone(phone: string) {
  return /^[0-9+\-\s()]{8,20}$/.test(phone);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const fullName = String(body.fullName || "").trim();
    const phone = String(body.phone || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    const preferredTime = String(body.preferredTime || "").trim();

    if (!fullName || fullName.length < 2) {
      return NextResponse.json({ error: "שם לא תקין" }, { status: 400 });
    }
    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });
    }
    if (!message || message.length < 5) {
      return NextResponse.json({ error: "הודעה קצרה מדי" }, { status: 400 });
    }

    const lead: Lead = {
      fullName,
      phone,
      email: email || undefined,
      message,
      preferredTime: preferredTime || undefined,
      createdAt: new Date().toISOString(),
      userAgent: req.headers.get("user-agent") || undefined
    };

    const dataDir = path.join(process.cwd(), "data");
    const filePath = path.join(dataDir, "leads.json");

    await fs.mkdir(dataDir, { recursive: true });

    let existing: Lead[] = [];
    try {
      const raw = await fs.readFile(filePath, "utf8");
      existing = JSON.parse(raw || "[]");
      if (!Array.isArray(existing)) {
        existing = [];
      }
    } catch {
      existing = [];
    }

    existing.unshift(lead);
    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), "utf8");

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "שגיאה כללית בשרת" }, { status: 500 });
  }
}
