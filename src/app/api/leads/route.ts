import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stageRequiresBudget } from "@/lib/leadStages";

export async function GET() {
  const session = await auth();
  const isEmployee = session?.user?.role === "Employee";
  const leads = await prisma.lead.findMany({
    where: isEmployee ? { assignedToId: session!.user.id } : undefined,
    include: { contact: true, assignedTo: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const session = await auth();
  const isEmployee = session?.user?.role === "Employee";

  const stage = body.stage || "Lead";
  if (stageRequiresBudget(stage) && !body.budgetRange) {
    return NextResponse.json(
      { error: "Budget Range is required from Qualification stage onward" },
      { status: 400 }
    );
  }

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

  // This contact already has an active lead — reuse it instead of creating a
  // second one, so the same person doesn't end up worked as two open deals.
  if (contactId) {
    const activeLead = await prisma.lead.findFirst({
      where: { contactId, status: { in: ["Open", "On Hold"] } },
      include: { contact: true, assignedTo: { select: { id: true, name: true, email: true } } },
    });
    if (activeLead) {
      return NextResponse.json({ ...activeLead, duplicate: true });
    }
  }

  const lead = await prisma.lead.create({
    data: {
      name: body.name,
      phone: body.phone || "",
      interest: body.interest || null,
      propertyType: body.propertyType || null,
      budgetRange: body.budgetRange || null,
      preferredLocation: body.preferredLocation || null,
      stage,
      status: body.status || "Open",
      lossReason: body.status === "Lost" ? body.lossReason || null : null,
      source: body.source || null,
      notes: body.notes || null,
      contactId,
      // Employees always own what they create; only Owners can assign to someone else.
      assignedToId: isEmployee ? session!.user.id : body.assignedToId || null,
    },
    include: { contact: true, assignedTo: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(lead, { status: 201 });
}
