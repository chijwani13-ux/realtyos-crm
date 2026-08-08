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
      status: body.status || "Open",
      lossReason: body.status === "Lost" ? body.lossReason || null : null,
      source: body.source ?? null,
      notes: body.notes ?? null,
    },
  });

  if (existing && lead.contactId && (existing.stage !== lead.stage || existing.status !== lead.status)) {
    const session = await auth();
    const createdBy = session?.user?.name || session?.user?.email || "Unknown";
    if (existing.stage !== lead.stage) {
      await prisma.interaction.create({
        data: {
          contactId: lead.contactId,
          type: "Stage Change",
          content: `Stage changed: ${existing.stage} → ${lead.stage}`,
          createdBy,
        },
      });
    }
    if (existing.status !== lead.status) {
      const reasonSuffix = lead.status === "Lost" && lead.lossReason ? ` (${lead.lossReason})` : "";
      await prisma.interaction.create({
        data: {
          contactId: lead.contactId,
          type: "Deal Update",
          content: `Status changed: ${existing.status} → ${lead.status}${reasonSuffix}`,
          createdBy,
        },
      });
    }
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
