import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";

export async function GET() {
  const check = await requireOwner();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const locations = await prisma.attendanceLocation.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(locations);
}

export async function POST(req: NextRequest) {
  const check = await requireOwner();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { userId, label, latitude, longitude, radiusMeters } = await req.json();
  if (!userId || !label || typeof latitude !== "number" || typeof longitude !== "number") {
    return NextResponse.json({ error: "User, label, and coordinates are required" }, { status: 400 });
  }

  const location = await prisma.attendanceLocation.create({
    data: {
      userId,
      label,
      latitude,
      longitude,
      radiusMeters: radiusMeters || 200,
    },
  });
  return NextResponse.json(location, { status: 201 });
}
