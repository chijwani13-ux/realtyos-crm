import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Maps stage values that no longer exist in the expanded pipeline to their closest new equivalent.
const STAGE_MAP: Record<string, string> = {
  "Site Visit": "Site Visit Done",
};

async function main() {
  const leads = await prisma.lead.findMany();
  console.log(`Found ${leads.length} leads before migration.`);

  let updated = 0;
  for (const lead of leads) {
    if (lead.stage in STAGE_MAP) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { stage: STAGE_MAP[lead.stage] },
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
