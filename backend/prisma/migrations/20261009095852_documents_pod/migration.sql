-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DELIVERY_NOTE', 'CMR', 'POD', 'DELIVERY_PHOTO', 'SERVICE_ATTACHMENT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('SHARED', 'INTERNAL');

-- CreateEnum
CREATE TYPE "PodStatus" AS ENUM ('PENDING', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ServiceEventType" ADD VALUE 'DOCUMENT_UPLOADED';
ALTER TYPE "ServiceEventType" ADD VALUE 'DOCUMENT_STATUS_CHANGED';
ALTER TYPE "ServiceEventType" ADD VALUE 'POD_SUBMITTED';
ALTER TYPE "ServiceEventType" ADD VALUE 'POD_STATUS_CHANGED';

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "podId" TEXT,
    "type" "DocumentType" NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'SHARED',
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentValidationHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "fromStatus" "DocumentStatus",
    "toStatus" "DocumentStatus" NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentValidationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofOfDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "serverSubmittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiverName" TEXT,
    "observations" TEXT,
    "status" "PodStatus" NOT NULL DEFAULT 'SUBMITTED',
    "verificationCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProofOfDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodValidationHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "podId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "fromStatus" "PodStatus",
    "toStatus" "PodStatus" NOT NULL,
    "reason" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodValidationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_organizationId_serviceId_uploadedAt_idx" ON "Document"("organizationId", "serviceId", "uploadedAt");

-- CreateIndex
CREATE INDEX "Document_podId_idx" ON "Document"("podId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_serviceId_sha256_key" ON "Document"("serviceId", "sha256");

-- CreateIndex
CREATE INDEX "DocumentValidationHistory_organizationId_documentId_changed_idx" ON "DocumentValidationHistory"("organizationId", "documentId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProofOfDelivery_serviceId_key" ON "ProofOfDelivery"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProofOfDelivery_verificationCode_key" ON "ProofOfDelivery"("verificationCode");

-- CreateIndex
CREATE INDEX "ProofOfDelivery_organizationId_status_serverSubmittedAt_idx" ON "ProofOfDelivery"("organizationId", "status", "serverSubmittedAt");

-- CreateIndex
CREATE INDEX "ProofOfDelivery_driverId_serverSubmittedAt_idx" ON "ProofOfDelivery"("driverId", "serverSubmittedAt");

-- CreateIndex
CREATE INDEX "PodValidationHistory_organizationId_podId_changedAt_idx" ON "PodValidationHistory"("organizationId", "podId", "changedAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_podId_fkey" FOREIGN KEY ("podId") REFERENCES "ProofOfDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentValidationHistory" ADD CONSTRAINT "DocumentValidationHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentValidationHistory" ADD CONSTRAINT "DocumentValidationHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentValidationHistory" ADD CONSTRAINT "DocumentValidationHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodValidationHistory" ADD CONSTRAINT "PodValidationHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodValidationHistory" ADD CONSTRAINT "PodValidationHistory_podId_fkey" FOREIGN KEY ("podId") REFERENCES "ProofOfDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodValidationHistory" ADD CONSTRAINT "PodValidationHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
