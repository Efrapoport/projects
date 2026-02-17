import { NextResponse } from "next/server";
import { generateDocs } from "@/lib/doc-generator";

export async function GET() {
  const docs = generateDocs();

  return NextResponse.json(docs, {
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
}
