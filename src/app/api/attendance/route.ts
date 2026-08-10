import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const isEmployee = session.user.role === "Employee";
  const records = await prisma.attendance.findMany({
    where: isEmployee ? { userId: session.user.id } : undefined,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { date: "desc" },
    take: 200,
  });
  return NextResponse.json(records);
}
