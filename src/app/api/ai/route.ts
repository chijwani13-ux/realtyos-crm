import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI Assistant isn't configured yet. Add an ANTHROPIC_API_KEY to enable it." },
      { status: 501 }
    );
  }

  const { question } = await req.json();
  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "Missing question" }, { status: 400 });
  }

  const [projects, buyers, leads] = await Promise.all([
    prisma.project.findMany({
      select: { name: true, price: true, builder: true, amenities: true, nearby: true },
    }),
    prisma.buyer.findMany({
      select: { name: true, budget: true, location: true, needs: true, status: true },
    }),
    prisma.lead.findMany({ select: { name: true, stage: true, interest: true } }),
  ]);

  const context = `Projects: ${JSON.stringify(projects)}\nBuyers: ${JSON.stringify(buyers)}\nLeads: ${JSON.stringify(leads)}`;

  const client = new Anthropic({ apiKey });
  try {
    const message = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `You are a real estate CRM assistant. Answer briefly and practically using this data:\n\n${context}\n\nQuestion: ${question}`,
        },
      ],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return NextResponse.json({ text: text || "I couldn't find an answer to that." });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong reaching the assistant. Try again." },
      { status: 502 }
    );
  }
}
