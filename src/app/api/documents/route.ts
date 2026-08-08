import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const documents = await prisma.document.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(documents);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const document = await prisma.document.create({
    data: {
      name: body.name,
      type: body.type || "Brochure",
      link: body.link,
    },
  });
  return NextResponse.json(document, { status: 201 });
}
