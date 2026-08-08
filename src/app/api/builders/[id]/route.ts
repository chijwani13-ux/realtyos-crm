import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const builder = await prisma.builder.update({
    where: { id },
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
  return NextResponse.json(builder);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.builder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
