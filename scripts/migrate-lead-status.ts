import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const LOSS_MAP: Record<string, string> = {
  Disqualified: "Disqualified",
  Rejected: "Rejected",
  Lost: "Other",
};

async function main() {
  const leads = await prisma.lead.findMany();
  console.log(`Found ${leads.length} leads before migration.`);

  let updated = 0;
  for (const lead of leads) {
    if (lead.status in LOSS_MAP) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "Lost", lossReason: LOSS_MAP[lead.status] },
      });
      updated++;
    } else if (lead.status === "Qualified") {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "Open" },
      });
      updated++;
    }
  }

  const after = await prisma.lead.findMany();
  console.log(`Updated ${updated} leads. Row count after: ${after.length} (should match ${leads.length}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
