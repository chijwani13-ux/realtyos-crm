import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(leads);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const lead = await prisma.lead.create({
    data: {
      name: body.name,
      phone: body.phone || "",
      interest: body.interest || null,
      stage: body.stage || "Lead",
      source: body.source || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(lead, { status: 201 });
}
