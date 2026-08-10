import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/permissions";

export async function GET() {
  const check = await requireOwner();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      position: true,
      accessStart: true,
      accessEnd: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(req: NextRequest) {
  const check = await requireOwner();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { email, password, name, role, position, accessStart, accessEnd } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if ((accessStart && !TIME_RE.test(accessStart)) || (accessEnd && !TIME_RE.test(accessEnd))) {
    return NextResponse.json({ error: "Access hours must be valid times" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const finalRole = role === "Owner" ? "Owner" : "Employee";
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name: name || null,
      role: finalRole,
      position: finalRole === "Employee" ? position || null : null,
      accessStart: finalRole === "Employee" ? accessStart || null : null,
      accessEnd: finalRole === "Employee" ? accessEnd || null : null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      position: true,
      accessStart: true,
      accessEnd: true,
      createdAt: true,
    },
  });
  return NextResponse.json(user, { status: 201 });
}
