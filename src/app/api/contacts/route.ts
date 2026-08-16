import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureLeadForBuyerContact } from "@/lib/contactLead";

function hideCommission<T extends { builderDetails: { commissionStructure: string | null } | null; brokerDetails: { commissionSplit: string | null } | null }>(
  contact: T
): T {
  return {
    ...contact,
    builderDetails: contact.builderDetails
      ? { ...contact.builderDetails, commissionStructure: null }
      : null,
    brokerDetails: contact.brokerDetails ? { ...contact.brokerDetails, commissionSplit: null } : null,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const type = req.nextUrl.searchParams.get("type");
  const contacts = await prisma.contact.findMany({
    where: type ? { types: { has: type } } : undefined,
    include: {
      buyerDetails: true,
      builderDetails: true,
      brokerDetails: true,
      vendorDetails: true,
      sellerDetails: true,
    },
    orderBy: { createdAt: "desc" },
  });
  if (session?.user?.role === "Employee") {
    return NextResponse.json(contacts.map(hideCommission));
  }
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
        status: body.brokerStatus || "Active",
      },
    });
  }
  if (types.includes("Vendor")) {
    await prisma.vendorDetails.create({
      data: {
        contactId: contact.id,
        serviceType: body.serviceType || null,
        rateCardRef: body.rateCardRef || null,
        status: body.vendorStatus || "Active",
      },
    });
  }
  if (types.includes("Seller")) {
    await prisma.sellerDetails.create({
      data: {
        contactId: contact.id,
        propertyRef: body.propertyRef || null,
        askingPrice: body.askingPrice || null,
        status: body.sellerStatus || "Active",
      },
    });
  }

  if (types.includes("Buyer")) {
    await ensureLeadForBuyerContact(contact.id);
  }

  const full = await prisma.contact.findUnique({
    where: { id: contact.id },
    include: {
      buyerDetails: true,
      builderDetails: true,
      brokerDetails: true,
      vendorDetails: true,
      sellerDetails: true,
    },
  });
  return NextResponse.json(full, { status: 201 });
}
