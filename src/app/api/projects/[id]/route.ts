import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const session = await auth();
  const project = await prisma.project.update({
    where: { id },
    data: {
      name: body.name,
      builder: body.builder || null,
      builderId: body.builderId || null,
      price: body.price || null,
      photo: body.photo || null,
      brochureLink: body.brochureLink || null,
      floorPlanLink: body.floorPlanLink || null,
      amenities: body.amenities || null,
      nearby: body.nearby || null,
      // Employees never see the real commission value (stripped on GET), so never
      // let their edits overwrite it — only Owners can change it.
      ...(session?.user?.role === "Employee" ? {} : { commission: body.commission || null }),
      notes: body.notes || null,
    },
  });
  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireOwner();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
