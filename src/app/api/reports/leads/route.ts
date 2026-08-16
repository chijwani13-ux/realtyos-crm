import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";
import { LEAD_STAGES } from "@/lib/leadStages";

export async function GET() {
  const check = await requireOwner();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const leads = await prisma.lead.findMany({
    select: { stage: true, status: true, source: true },
  });

  const funnel = LEAD_STAGES.map((stage) => ({
    stage,
    count: leads.filter((l) => l.stage === stage).length,
  }));

  const won = leads.filter((l) => l.status === "Won").length;
  const lost = leads.filter((l) => l.status === "Lost").length;
  const open = leads.filter((l) => l.status === "Open").length;
  const onHold = leads.filter((l) => l.status === "On Hold").length;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;

  const sourceMap = new Map<string, { total: number; won: number; lost: number }>();
  for (const l of leads) {
    const key = l.source || "Not set";
    const entry = sourceMap.get(key) || { total: 0, won: 0, lost: 0 };
    entry.total++;
    if (l.status === "Won") entry.won++;
    if (l.status === "Lost") entry.lost++;
    sourceMap.set(key, entry);
  }
  const sourcePerformance = [...sourceMap.entries()]
    .map(([source, s]) => ({
      source,
      total: s.total,
      won: s.won,
      lost: s.lost,
      winRate: s.won + s.lost > 0 ? Math.round((s.won / (s.won + s.lost)) * 100) : null,
    }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    funnel,
    statusBreakdown: { open, onHold, won, lost },
    winRate,
    totalLeads: leads.length,
    sourcePerformance,
  });
}
