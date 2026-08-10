import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createLeadFromExternalSource } from "@/lib/contactLead";

// --- Meta (Facebook/Instagram) Lead Ads webhook ---
//
// Setup on Meta's side (once you have a Meta Developer account + Page):
// 1. Create a Meta App at developers.facebook.com, add the "Webhooks" and
//    "Leads Access" products.
// 2. Set this route's URL as the webhook callback:
//    https://<your-domain>/api/webhooks/meta-leads
// 3. Set META_WEBHOOK_VERIFY_TOKEN (any string you choose) as an env var
//    here AND paste the same value into Meta's webhook "Verify Token" field.
// 4. Set META_APP_SECRET (from your Meta App's Basic Settings) as an env var.
// 5. Generate a Page Access Token for your connected Facebook Page and set
//    it as META_PAGE_ACCESS_TOKEN.
// 6. Subscribe your Page to the "leadgen" webhook field, and connect your
//    Instagram Business account to the same Page — Instagram lead ads use
//    the same Lead Ads infrastructure.
// Until those env vars are set, this route safely no-ops (verification
// fails, and incoming leads are rejected) rather than crashing the build.

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

async function fetchLeadDetails(leadgenId: string) {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${accessToken}`
  );
  if (!res.ok) return null;
  const json = await res.json();
  const fields: Record<string, string> = {};
  for (const f of json.field_data || []) {
    fields[f.name] = f.values?.[0] || "";
  }
  return fields;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const payload = JSON.parse(rawBody);
  const created: string[] = [];

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "leadgen") continue;
      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;

      const fields = await fetchLeadDetails(leadgenId);
      if (!fields) continue;

      const name = fields.full_name || fields.first_name || "Facebook/Instagram Lead";
      const phone = fields.phone_number || "";
      if (!phone) continue; // no way to dedupe/contact without a phone

      const lead = await createLeadFromExternalSource({
        name,
        phone,
        email: fields.email || null,
        interest: fields.city || fields.property_type || null,
        source: "Facebook/Instagram Ad",
      });
      created.push(lead.id);
    }
  }

  return NextResponse.json({ ok: true, created });
}
