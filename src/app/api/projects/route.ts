import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const projects = await prisma.project.findMany({
    include: { builderContact: true },
    orderBy: { createdAt: "desc" },
  });
  if (session?.user?.role === "Employee") {
    return NextResponse.json(projects.map((p) => ({ ...p, commission: null })));
  }
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const project = await prisma.project.create({
    data: {
      name: body.name,
      builder: body.builder || null,
      builderId: body.builderId || null,
      price: body.price || null,
      photo: body.photo || null,
      brochureLink: body.brochureLink || null,
      floorPlanLink: body.floorPlanLink || null,
      amenities: body.amenities || null,
      nearby: body.nearby || null,
      commission: body.commission || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(project, { status: 201 });
}
