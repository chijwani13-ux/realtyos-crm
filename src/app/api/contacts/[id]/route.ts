import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureLeadForBuyerContact } from "@/lib/contactLead";
import { requireOwner } from "@/lib/permissions";

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
      vendorDetails: true,
      sellerDetails: true,
      interactions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await auth();
  if (session?.user?.role === "Employee") {
    return NextResponse.json({
      ...contact,
      builderDetails: contact.builderDetails
        ? { ...contact.builderDetails, commissionStructure: null }
        : null,
      brokerDetails: contact.brokerDetails
        ? { ...contact.brokerDetails, commissionSplit: null }
        : null,
    });
  }
  return NextResponse.json(contact);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const types: string[] = Array.isArray(body.types) ? body.types : [];
  const session = await auth();
  const isEmployee = session?.user?.role === "Employee";

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
        commissionStructure: isEmployee ? null : body.commissionStructure || null,
        lastVisited: body.lastVisited ? new Date(body.lastVisited) : null,
        nextVisit: body.nextVisit ? new Date(body.nextVisit) : null,
        brochureLink: body.brochureLink || null,
      },
      update: {
        projects: body.projects || null,
        // Employees never see the real commission value (stripped on GET), so never
        // let their edits overwrite it — only Owners can change it.
        ...(isEmployee ? {} : { commissionStructure: body.commissionStructure || null }),
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
        commissionSplit: isEmployee ? null : body.commissionSplit || null,
        status: body.brokerStatus || "Active",
      },
      update: {
        agencyName: body.agencyName || null,
        ...(isEmployee ? {} : { commissionSplit: body.commissionSplit || null }),
        status: body.brokerStatus || "Active",
      },
    });
  } else {
    await prisma.brokerDetails.deleteMany({ where: { contactId: id } });
  }

  if (types.includes("Vendor")) {
    await prisma.vendorDetails.upsert({
      where: { contactId: id },
      create: {
        contactId: id,
        serviceType: body.serviceType || null,
        rateCardRef: body.rateCardRef || null,
        status: body.vendorStatus || "Active",
      },
      update: {
        serviceType: body.serviceType || null,
        rateCardRef: body.rateCardRef || null,
        status: body.vendorStatus || "Active",
      },
    });
  } else {
    await prisma.vendorDetails.deleteMany({ where: { contactId: id } });
  }

  if (types.includes("Seller")) {
    await prisma.sellerDetails.upsert({
      where: { contactId: id },
      create: {
        contactId: id,
        propertyRef: body.propertyRef || null,
        askingPrice: body.askingPrice || null,
        status: body.sellerStatus || "Active",
      },
      update: {
        propertyRef: body.propertyRef || null,
        askingPrice: body.askingPrice || null,
        status: body.sellerStatus || "Active",
      },
    });
  } else {
    await prisma.sellerDetails.deleteMany({ where: { contactId: id } });
  }

  if (types.includes("Buyer")) {
    await ensureLeadForBuyerContact(id);
  }

  const full = await prisma.contact.findUnique({
    where: { id },
    include: {
      buyerDetails: true,
      builderDetails: true,
      brokerDetails: true,
      vendorDetails: true,
      sellerDetails: true,
    },
  });
  return NextResponse.json(full);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireOwner();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
