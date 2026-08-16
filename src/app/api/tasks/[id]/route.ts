import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { advanceDate } from "@/lib/recurrence";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.task.findUnique({ where: { id } });

  const task = await prisma.task.update({
    where: { id },
    data: {
      title: body.title,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      contactId: body.contactId ?? undefined,
      status: body.status,
    },
  });

  // Completing a recurring task spawns its next occurrence instead of
  // leaving multiple stacked instances. If recurringUntilCancelled is off,
  // the spawned occurrence is the last one (freq resets to "none").
  const justCompleted = existing && existing.status !== "done" && task.status === "done";
  if (justCompleted && task.recurrenceFreq !== "none") {
    const base = task.dueDate ?? new Date();
    await prisma.task.create({
      data: {
        title: task.title,
        dueDate: advanceDate(base, task.recurrenceFreq, task.recurrenceInterval),
        contactId: task.contactId,
        status: "pending",
        recurrenceFreq: task.recurringUntilCancelled ? task.recurrenceFreq : "none",
        recurrenceInterval: task.recurrenceInterval,
        recurringUntilCancelled: task.recurringUntilCancelled,
      },
    });
  }

  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
