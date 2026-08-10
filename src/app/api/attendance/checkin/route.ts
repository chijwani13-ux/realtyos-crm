import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { distanceMeters, todayStrIST } from "@/lib/geo";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { latitude, longitude } = await req.json();
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return NextResponse.json({ error: "Location is required" }, { status: 400 });
  }

  const locations = await prisma.attendanceLocation.findMany({
    where: { userId: session.user.id },
  });
  if (locations.length === 0) {
    return NextResponse.json(
      { error: "No allowed locations have been set up for you yet. Ask your Owner to add one." },
      { status: 400 }
    );
  }

  let matched: (typeof locations)[number] | null = null;
  let closestDistance = Infinity;
  for (const loc of locations) {
    const d = distanceMeters(latitude, longitude, loc.latitude, loc.longitude);
    if (d < closestDistance) closestDistance = d;
    if (d <= loc.radiusMeters) {
      matched = loc;
      break;
    }
  }

  if (!matched) {
    return NextResponse.json(
      {
        error: `You're ${Math.round(closestDistance)}m away from your nearest allowed location — too far to check in.`,
      },
      { status: 400 }
    );
  }

  const date = todayStrIST();
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
  });
  if (existing?.checkInAt) {
    return NextResponse.json({ error: "Already checked in today" }, { status: 400 });
  }

  const attendance = await prisma.attendance.upsert({
    where: { userId_date: { userId: session.user.id, date } },
    create: {
      userId: session.user.id,
      date,
      checkInAt: new Date(),
      checkInLat: latitude,
      checkInLng: longitude,
      checkInLocation: matched.label,
    },
    update: {
      checkInAt: new Date(),
      checkInLat: latitude,
      checkInLng: longitude,
      checkInLocation: matched.label,
    },
  });
  return NextResponse.json(attendance);
}
