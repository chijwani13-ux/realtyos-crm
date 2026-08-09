import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { date: "asc" },
    include: { project: { select: { id: true, name: true } } },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const event = await prisma.event.create({
    data: {
      title: body.title,
      type: body.type || "Meeting",
      date: body.date,
      time: body.time || null,
      projectId: body.projectId || null,
    },
    include: { project: { select: { id: true, name: true } } },
  });
  return NextResponse.json(event, { status: 201 });
}
