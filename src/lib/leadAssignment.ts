import { prisma } from "@/lib/prisma";

/**
 * Picks who a new, unassigned lead should go to based on the configured
 * assignment method. Returns null for "manual" (or when no employee is
 * available), leaving the lead unassigned for an Owner to pick by hand.
 */
export async function autoAssignLead(): Promise<string | null> {
  const settings = await prisma.leadAssignmentSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  if (settings.method === "manual") return null;

  const available = await prisma.user.findMany({
    where: { role: "Employee", availableForLeads: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (available.length === 0) return null;

  if (settings.method === "round_robin") {
    const lastIndex = available.findIndex((u) => u.id === settings.lastAssignedUserId);
    const next = available[(lastIndex + 1) % available.length];
    await prisma.leadAssignmentSettings.update({
      where: { id: "default" },
      data: { lastAssignedUserId: next.id },
    });
    return next.id;
  }

  if (settings.method === "least_busy") {
    const counts = await Promise.all(
      available.map(async (u) => ({
        id: u.id,
        count: await prisma.lead.count({
          where: { assignedToId: u.id, status: { in: ["Open", "On Hold"] } },
        }),
      }))
    );
    counts.sort((a, b) => a.count - b.count);
    return counts[0].id;
  }

  return null;
}
