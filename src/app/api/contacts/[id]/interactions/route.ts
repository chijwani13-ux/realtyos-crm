import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  if (!body.type || !body.content) {
    return NextResponse.json({ error: "type and content are required" }, { status: 400 });
  }
  const session = await auth();
  const interaction = await prisma.interaction.create({
    data: {
      contactId: id,
      type: body.type,
      content: body.content,
      createdBy: session?.user?.name || session?.user?.email || "Unknown",
    },
  });
  return NextResponse.json(interaction, { status: 201 });
}
