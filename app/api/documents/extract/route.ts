import { NextResponse } from "next/server";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was provided." }, { status: 400 });
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    if (extension === "txt") {
      return NextResponse.json({ text: buffer.toString("utf8") });
    }

    if (extension === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      return NextResponse.json({ text: result.value });
    }

    if (extension === "xlsx") {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const text = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        return [`Sheet: ${sheetName}`, JSON.stringify(rows, null, 2)].join("\n");
      }).join("\n\n");
      return NextResponse.json({ text });
    }

    if (extension === "pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buffer);
      return NextResponse.json({ text: result.text });
    }

    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to extract text from document.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
