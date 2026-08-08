import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const builders = await prisma.builder.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(builders);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const builder = await prisma.builder.create({
    data: {
      name: body.name,
      contact: body.contact || null,
      projects: body.projects || null,
      commission: body.commission || null,
      lastVisited: body.lastVisited ? new Date(body.lastVisited) : null,
      nextVisit: body.nextVisit ? new Date(body.nextVisit) : null,
      brochureLink: body.brochureLink || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(builder, { status: 201 });
}
