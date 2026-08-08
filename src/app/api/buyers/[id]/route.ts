import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const buyer = await prisma.buyer.update({
    where: { id },
    data: {
      name: body.name,
      budget: body.budget || null,
      location: body.location || null,
      needs: body.needs || null,
      status: body.status,
      lastContact: body.lastContact ? new Date(body.lastContact) : null,
      nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
      interestedProjects: body.interestedProjects || null,
    },
  });
  return NextResponse.json(buyer);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.buyer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
