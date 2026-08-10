-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "assignedToId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessEnd" TEXT,
ADD COLUMN     "accessStart" TEXT,
ADD COLUMN     "position" TEXT;

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
