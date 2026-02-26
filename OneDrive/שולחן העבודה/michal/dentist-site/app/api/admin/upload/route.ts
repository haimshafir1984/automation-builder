import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif"
]);

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, "-")
    .replace(/-+/g, "-");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!allowedMimeTypes.has(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const fileName = `${Date.now()}-${sanitizeFileName(file.name || "image")}`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.writeFile(filePath, buffer);
    const url = `/uploads/${fileName}`;

    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
