import { prisma } from "@/lib/prisma";

/**
 * Creates (or reuses, matched by phone) a Contact + Lead pair for an
 * inbound lead from an external source (e.g. a Facebook/Instagram lead
 * ad webhook). Mirrors the dedupe-by-phone logic in POST /api/leads.
 */
export async function createLeadFromExternalSource(data: {
  name: string;
  phone: string;
  email?: string | null;
  interest?: string | null;
  source: string;
  notes?: string | null;
}) {
  let contactId: string | null = null;
  const existing = await prisma.contact.findFirst({ where: { phone: data.phone } });
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
      data: { name: data.name, phone: data.phone, email: data.email || null, types: ["Buyer"] },
    });
    await prisma.buyerDetails.create({
      data: { contactId: contact.id, needs: data.interest || null },
    });
    contactId = contact.id;
  }

  // Already has an active lead — don't spawn a second one for the same
  // person; log it on their existing timeline instead.
  const activeLead = await prisma.lead.findFirst({
    where: { contactId, status: { in: ["Open", "On Hold"] } },
  });
  if (activeLead) {
    await prisma.interaction.create({
      data: {
        contactId,
        type: "Note",
        content: `Duplicate lead received from ${data.source} — already has an open lead`,
        createdBy: "System",
      },
    });
    return activeLead;
  }

  return prisma.lead.create({
    data: {
      name: data.name,
      phone: data.phone,
      interest: data.interest || null,
      stage: "Lead",
      status: "Open",
      source: data.source,
      notes: data.notes || null,
      contactId,
    },
  });
}

/**
 * Ensures a Buyer-type contact has a corresponding Lead in the pipeline.
 * Safe to call whenever a contact's types change — no-ops if a lead
 * already exists for this contact, or if the contact isn't a Buyer.
 */
export async function ensureLeadForBuyerContact(contactId: string) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { buyerDetails: true },
  });
  if (!contact || !contact.types.includes("Buyer")) return;

  const existingLead = await prisma.lead.findFirst({ where: { contactId } });
  if (existingLead) return;

  await prisma.lead.create({
    data: {
      name: contact.name,
      phone: contact.phone || "",
      interest: contact.buyerDetails?.needs || null,
      stage: "Lead",
      status: "Open",
      contactId,
    },
  });
}
