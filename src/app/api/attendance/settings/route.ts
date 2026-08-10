import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const settings = await prisma.attendanceSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const check = await requireOwner();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { fullDayHours, halfDayHours } = await req.json();
  if (typeof fullDayHours !== "number" || typeof halfDayHours !== "number" || halfDayHours >= fullDayHours) {
    return NextResponse.json(
      { error: "Full day hours must be greater than half day hours" },
      { status: 400 }
    );
  }

  const settings = await prisma.attendanceSettings.upsert({
    where: { id: "default" },
    create: { id: "default", fullDayHours, halfDayHours },
    update: { fullDayHours, halfDayHours },
  });
  return NextResponse.json(settings);
}
