-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "contactId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "builderId" TEXT;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "types" TEXT[],
    "company" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerDetails" (
    "contactId" TEXT NOT NULL,
    "budget" TEXT,
    "preferredLocation" TEXT,
    "needs" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Looking',
    "nextFollowUp" TIMESTAMP(3),

    CONSTRAINT "BuyerDetails_pkey" PRIMARY KEY ("contactId")
);

-- CreateTable
CREATE TABLE "BuilderDetails" (
    "contactId" TEXT NOT NULL,
    "projects" TEXT,
    "commissionStructure" TEXT,
    "lastVisited" TIMESTAMP(3),
    "nextVisit" TIMESTAMP(3),
    "brochureLink" TEXT,

    CONSTRAINT "BuilderDetails_pkey" PRIMARY KEY ("contactId")
);

-- CreateTable
CREATE TABLE "BrokerDetails" (
    "contactId" TEXT NOT NULL,
    "agencyName" TEXT,
    "commissionSplit" TEXT,

    CONSTRAINT "BrokerDetails_pkey" PRIMARY KEY ("contactId")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interaction_contactId_idx" ON "Interaction"("contactId");

-- CreateIndex
CREATE INDEX "Lead_contactId_idx" ON "Lead"("contactId");

-- CreateIndex
CREATE INDEX "Project_builderId_idx" ON "Project"("builderId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerDetails" ADD CONSTRAINT "BuyerDetails_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderDetails" ADD CONSTRAINT "BuilderDetails_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerDetails" ADD CONSTRAINT "BrokerDetails_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
