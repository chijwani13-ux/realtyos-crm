import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";

const METHODS = ["manual", "round_robin", "least_busy"];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const settings = await prisma.leadAssignmentSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const check = await requireOwner();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { method } = await req.json();
  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: "Invalid assignment method" }, { status: 400 });
  }

  const settings = await prisma.leadAssignmentSettings.upsert({
    where: { id: "default" },
    create: { id: "default", method },
    update: { method },
  });
  return NextResponse.json(settings);
}
