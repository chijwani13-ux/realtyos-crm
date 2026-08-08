import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.lead.findUnique({ where: { id } });

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      name: body.name,
      phone: body.phone,
      interest: body.interest ?? null,
      stage: body.stage,
      source: body.source ?? null,
      notes: body.notes ?? null,
    },
  });

  if (existing && existing.stage !== lead.stage && lead.contactId) {
    const session = await auth();
    await prisma.interaction.create({
      data: {
        contactId: lead.contactId,
        type: "Stage Change",
        content: `Stage changed: ${existing.stage} → ${lead.stage}`,
        createdBy: session?.user?.name || session?.user?.email || "Unknown",
      },
    });
  }

  return NextResponse.json(lead);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
