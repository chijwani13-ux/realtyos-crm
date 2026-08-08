import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const buyers = await prisma.buyer.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(buyers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const buyer = await prisma.buyer.create({
    data: {
      name: body.name,
      budget: body.budget || null,
      location: body.location || null,
      needs: body.needs || null,
      status: body.status || "Looking",
      lastContact: body.lastContact ? new Date(body.lastContact) : null,
      nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
      interestedProjects: body.interestedProjects || null,
    },
  });
  return NextResponse.json(buyer, { status: 201 });
}
