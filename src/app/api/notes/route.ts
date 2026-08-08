import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const notes = await prisma.note.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const note = await prisma.note.create({
    data: {
      type: body.type || "Meeting",
      relatedTo: body.relatedTo || null,
      text: body.text,
    },
  });
  return NextResponse.json(note, { status: 201 });
}
