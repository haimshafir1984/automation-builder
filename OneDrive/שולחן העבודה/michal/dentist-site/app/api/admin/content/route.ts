import { NextResponse } from "next/server";
import {
  editableSections,
  getSiteContent,
  updateSiteContentSection
} from "@/lib/site-content";

function isEditableSection(value: string): value is (typeof editableSections)[number] {
  return editableSections.includes(value as (typeof editableSections)[number]);
}

export async function GET() {
  const content = await getSiteContent();
  return NextResponse.json({ ok: true, content });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const section = String(body?.section || "");
    const data = body?.data;

    if (!isEditableSection(section)) {
      return NextResponse.json({ error: "Section not allowed" }, { status: 400 });
    }

    const content = await updateSiteContentSection(section, data);
    return NextResponse.json({ ok: true, content });
  } catch {
    return NextResponse.json({ error: "Failed to save content" }, { status: 500 });
  }
}
