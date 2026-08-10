import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { todayStrIST } from "@/lib/geo";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { latitude, longitude } = await req.json();
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return NextResponse.json({ error: "Location is required" }, { status: 400 });
  }

  const date = todayStrIST();
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
  });
  if (!existing?.checkInAt) {
    return NextResponse.json({ error: "You haven't checked in today" }, { status: 400 });
  }
  if (existing.checkOutAt) {
    return NextResponse.json({ error: "Already checked out today" }, { status: 400 });
  }

  const settings = await prisma.attendanceSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  const checkOutAt = new Date();
  const hoursWorked = (checkOutAt.getTime() - existing.checkInAt.getTime()) / 3600000;
  const status =
    hoursWorked >= settings.fullDayHours
      ? "Full Day"
      : hoursWorked >= settings.halfDayHours
        ? "Half Day"
        : "Absent";

  const attendance = await prisma.attendance.update({
    where: { id: existing.id },
    data: { checkOutAt, checkOutLat: latitude, checkOutLng: longitude, status },
  });
  return NextResponse.json(attendance);
}
