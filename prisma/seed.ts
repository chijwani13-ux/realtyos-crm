import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.lead.count();
  if (existing > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  await prisma.lead.createMany({
    data: [
      {
        name: "Rohit Deshmukh",
        phone: "+91 98220 11122",
        interest: "3BHK Wardha Road",
        stage: "Lead",
        source: "Website",
      },
      {
        name: "Sneha Kulkarni",
        phone: "+91 99230 44556",
        interest: "Shop Sitabuldi",
        stage: "Site Visit",
        source: "Referral",
      },
    ],
  });

  await prisma.buyer.create({
    data: {
      name: "Dr. Sharma",
      budget: "₹1.5 Cr",
      location: "Dharampeth",
      needs: "3 BHK",
      status: "Looking",
      nextFollowUp: new Date(),
    },
  });

  await prisma.builder.create({
    data: {
      name: "Kohinoor Group",
      contact: "+91 98230 55667",
      projects: "Green Meadows, Skyline Residency",
      commission: "2%",
    },
  });

  await prisma.project.create({
    data: {
      name: "Green Meadows Phase 2",
      builder: "Kohinoor Group",
      price: "₹42,00,000",
      amenities: "Clubhouse, Gym, Garden",
      nearby: "Wardha Road, Nagpur",
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
