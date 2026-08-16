-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "recurrenceFreq" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "recurringUntilCancelled" BOOLEAN NOT NULL DEFAULT false;
