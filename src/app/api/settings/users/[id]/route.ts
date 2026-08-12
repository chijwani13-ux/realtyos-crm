import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireOwner();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const { name, role, position, accessStart, accessEnd, attendanceEnabled } = await req.json();

  if ((accessStart && !TIME_RE.test(accessStart)) || (accessEnd && !TIME_RE.test(accessEnd))) {
    return NextResponse.json({ error: "Access hours must be valid times" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const finalRole = role === "Owner" ? "Owner" : "Employee";
  if (target.role === "Owner" && finalRole === "Employee") {
    const ownerCount = await prisma.user.count({ where: { role: "Owner" } });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "Can't demote the last Owner account" }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: name || null,
      role: finalRole,
      position: finalRole === "Employee" ? position || null : null,
      accessStart: finalRole === "Employee" ? accessStart || null : null,
      accessEnd: finalRole === "Employee" ? accessEnd || null : null,
      attendanceEnabled: finalRole === "Employee" ? attendanceEnabled !== false : true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      position: true,
      accessStart: true,
      accessEnd: true,
      attendanceEnabled: true,
      createdAt: true,
    },
  });
  return NextResponse.json(user);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireOwner();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;

  if (check.session.user.id === id) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (target.role === "Owner") {
    const ownerCount = await prisma.user.count({ where: { role: "Owner" } });
    if (ownerCount <= 1) {
      return NextResponse.json({ error: "Can't delete the last Owner account" }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
