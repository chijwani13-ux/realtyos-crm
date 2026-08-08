import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureLeadForBuyerContact } from "@/lib/contactLead";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const contacts = await prisma.contact.findMany({
    where: type ? { types: { has: type } } : undefined,
    include: { buyerDetails: true, builderDetails: true, brokerDetails: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const types: string[] = Array.isArray(body.types) ? body.types : [];

  const contact = await prisma.contact.create({
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
    await prisma.buyerDetails.create({
      data: {
        contactId: contact.id,
        budget: body.budget || null,
        preferredLocation: body.preferredLocation || null,
        needs: body.needs || null,
        status: body.status || "Looking",
        nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
      },
    });
  }
  if (types.includes("Builder")) {
    await prisma.builderDetails.create({
      data: {
        contactId: contact.id,
        projects: body.projects || null,
        commissionStructure: body.commissionStructure || null,
        lastVisited: body.lastVisited ? new Date(body.lastVisited) : null,
        nextVisit: body.nextVisit ? new Date(body.nextVisit) : null,
        brochureLink: body.brochureLink || null,
      },
    });
  }
  if (types.includes("Broker")) {
    await prisma.brokerDetails.create({
      data: {
        contactId: contact.id,
        agencyName: body.agencyName || null,
        commissionSplit: body.commissionSplit || null,
      },
    });
  }

  if (types.includes("Buyer")) {
    await ensureLeadForBuyerContact(contact.id);
  }

  const full = await prisma.contact.findUnique({
    where: { id: contact.id },
    include: { buyerDetails: true, builderDetails: true, brokerDetails: true },
  });
  return NextResponse.json(full, { status: 201 });
}
