import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const leads = await prisma.lead.findMany({
    include: { contact: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Auto-create (or reuse) a Contact for this lead so it references contact_id
  // under the hood, matching by phone to avoid duplicate contacts.
  let contactId: string | null = null;
  if (body.phone) {
    const existing = await prisma.contact.findFirst({ where: { phone: body.phone } });
    if (existing) {
      contactId = existing.id;
      if (!existing.types.includes("Buyer")) {
        await prisma.contact.update({
          where: { id: existing.id },
          data: { types: [...existing.types, "Buyer"] },
        });
      }
    } else {
      const contact = await prisma.contact.create({
        data: { name: body.name, phone: body.phone, types: ["Buyer"] },
      });
      await prisma.buyerDetails.create({
        data: { contactId: contact.id, needs: body.interest || null },
      });
      contactId = contact.id;
    }
  }

  const lead = await prisma.lead.create({
    data: {
      name: body.name,
      phone: body.phone || "",
      interest: body.interest || null,
      stage: body.stage || "Lead",
      status: body.status || "Open",
      source: body.source || null,
      notes: body.notes || null,
      contactId,
    },
    include: { contact: true },
  });
  return NextResponse.json(lead, { status: 201 });
}
