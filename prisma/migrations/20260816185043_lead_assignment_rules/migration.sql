-- AlterTable
ALTER TABLE "User" ADD COLUMN     "availableForLeads" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "LeadAssignmentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "method" TEXT NOT NULL DEFAULT 'manual',
    "lastAssignedUserId" TEXT,

    CONSTRAINT "LeadAssignmentSettings_pkey" PRIMARY KEY ("id")
);
