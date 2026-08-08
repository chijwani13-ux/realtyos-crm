import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      buyerDetails: true,
      builderDetails: true,
      brokerDetails: true,
      interactions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(contact);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const types: string[] = Array.isArray(body.types) ? body.types : [];

  await prisma.contact.update({
    where: { id },
    data: {
      name: body.name,
      phone: body.phone || null,
      email: body.email || null,
      types,
      company: body.company || null,
      tags: body.tags || null,
    },
  });

  if (types.includes("Buyer")) {
    await prisma.buyerDetails.upsert({
      where: { contactId: id },
      create: {
        contactId: id,
        budget: body.budget || null,
        preferredLocation: body.preferredLocation || null,
        needs: body.needs || null,
        status: body.status || "Looking",
        nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
      },
      update: {
        budget: body.budget || null,
        preferredLocation: body.preferredLocation || null,
        needs: body.needs || null,
        status: body.status || "Looking",
        nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
      },
    });
  } else {
    await prisma.buyerDetails.deleteMany({ where: { contactId: id } });
  }

  if (types.includes("Builder")) {
    await prisma.builderDetails.upsert({
      where: { contactId: id },
      create: {
        contactId: id,
        projects: body.projects || null,
        commissionStructure: body.commissionStructure || null,
        lastVisited: body.lastVisited ? new Date(body.lastVisited) : null,
        nextVisit: body.nextVisit ? new Date(body.nextVisit) : null,
        brochureLink: body.brochureLink || null,
      },
      update: {
        projects: body.projects || null,
        commissionStructure: body.commissionStructure || null,
        lastVisited: body.lastVisited ? new Date(body.lastVisited) : null,
        nextVisit: body.nextVisit ? new Date(body.nextVisit) : null,
        brochureLink: body.brochureLink || null,
      },
    });
  } else {
    await prisma.builderDetails.deleteMany({ where: { contactId: id } });
  }

  if (types.includes("Broker")) {
    await prisma.brokerDetails.upsert({
      where: { contactId: id },
      create: {
        contactId: id,
        agencyName: body.agencyName || null,
        commissionSplit: body.commissionSplit || null,
      },
      update: {
        agencyName: body.agencyName || null,
        commissionSplit: body.commissionSplit || null,
      },
    });
  } else {
    await prisma.brokerDetails.deleteMany({ where: { contactId: id } });
  }

  const full = await prisma.contact.findUnique({
    where: { id },
    include: { buyerDetails: true, builderDetails: true, brokerDetails: true },
  });
  return NextResponse.json(full);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
