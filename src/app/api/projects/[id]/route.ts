import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const project = await prisma.project.update({
    where: { id },
    data: {
      name: body.name,
      builder: body.builder || null,
      price: body.price || null,
      photo: body.photo || null,
      brochureLink: body.brochureLink || null,
      floorPlanLink: body.floorPlanLink || null,
      amenities: body.amenities || null,
      nearby: body.nearby || null,
      commission: body.commission || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
