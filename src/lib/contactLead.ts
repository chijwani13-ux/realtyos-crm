import { prisma } from "@/lib/prisma";

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
