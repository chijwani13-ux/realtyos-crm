-- AlterTable
ALTER TABLE "BrokerDetails" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Active';

-- CreateTable
CREATE TABLE "VendorDetails" (
    "contactId" TEXT NOT NULL,
    "serviceType" TEXT,
    "rateCardRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',

    CONSTRAINT "VendorDetails_pkey" PRIMARY KEY ("contactId")
);

-- CreateTable
CREATE TABLE "SellerDetails" (
    "contactId" TEXT NOT NULL,
    "propertyRef" TEXT,
    "askingPrice" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',

    CONSTRAINT "SellerDetails_pkey" PRIMARY KEY ("contactId")
);

-- AddForeignKey
ALTER TABLE "VendorDetails" ADD CONSTRAINT "VendorDetails_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerDetails" ADD CONSTRAINT "SellerDetails_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
