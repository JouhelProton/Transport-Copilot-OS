-- CreateEnum
CREATE TYPE "EtaStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "DelayLevel" AS ENUM ('ON_TIME', 'RISK', 'CONFIRMED', 'DATA_INSUFFICIENT');

-- CreateEnum
CREATE TYPE "GeofenceKind" AS ENUM ('ORIGIN', 'DESTINATION');

-- CreateEnum
CREATE TYPE "GeofenceEventKind" AS ENUM ('ENTERED', 'EXITED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('DELAY', 'BREAKDOWN', 'LOADING_PROBLEM', 'UNLOADING_PROBLEM', 'WRONG_ADDRESS', 'DOCUMENT_PROBLEM', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IncidentPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DELAY_DETECTED', 'INCIDENT_CREATED', 'ARRIVAL_DETECTED', 'GPS_STALE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ServiceEventType" ADD VALUE 'ETA_UPDATED';
ALTER TYPE "ServiceEventType" ADD VALUE 'DELAY_STATUS_CHANGED';
ALTER TYPE "ServiceEventType" ADD VALUE 'GEOFENCE_ENTERED';
ALTER TYPE "ServiceEventType" ADD VALUE 'GEOFENCE_EXITED';
ALTER TYPE "ServiceEventType" ADD VALUE 'INCIDENT_CREATED';
ALTER TYPE "ServiceEventType" ADD VALUE 'INCIDENT_UPDATED';

-- CreateTable
CREATE TABLE "EtaEstimate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" "EtaStatus" NOT NULL,
    "estimatedArrival" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "distanceMeters" INTEGER,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "unavailableReason" TEXT,
    "originLat" DECIMAL(9,6),
    "originLng" DECIMAL(9,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtaEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOperationalState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "delayLevel" "DelayLevel" NOT NULL DEFAULT 'DATA_INSUFFICIENT',
    "delayMinutes" INTEGER,
    "gpsStale" BOOLEAN NOT NULL DEFAULT false,
    "noProgress" BOOLEAN NOT NULL DEFAULT false,
    "reasons" JSONB NOT NULL,
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOperationalState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceGeofence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "kind" "GeofenceKind" NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 250,
    "isInside" BOOLEAN NOT NULL DEFAULT false,
    "lastTransitionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceGeofence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeofenceEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "geofenceId" TEXT NOT NULL,
    "kind" "GeofenceEventKind" NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy" DECIMAL(7,2) NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "IncidentPriority" NOT NULL DEFAULT 'MEDIUM',
    "reportedByUserId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "fromStatus" "IncidentStatus",
    "toStatus" "IncidentStatus" NOT NULL,
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNotification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EtaEstimate_serviceId_key" ON "EtaEstimate"("serviceId");

-- CreateIndex
CREATE INDEX "EtaEstimate_organizationId_status_calculatedAt_idx" ON "EtaEstimate"("organizationId", "status", "calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOperationalState_serviceId_key" ON "ServiceOperationalState"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceOperationalState_organizationId_delayLevel_gpsStale_idx" ON "ServiceOperationalState"("organizationId", "delayLevel", "gpsStale");

-- CreateIndex
CREATE INDEX "ServiceGeofence_organizationId_kind_idx" ON "ServiceGeofence"("organizationId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceGeofence_serviceId_kind_key" ON "ServiceGeofence"("serviceId", "kind");

-- CreateIndex
CREATE INDEX "GeofenceEvent_organizationId_serviceId_recordedAt_idx" ON "GeofenceEvent"("organizationId", "serviceId", "recordedAt");

-- CreateIndex
CREATE INDEX "GeofenceEvent_geofenceId_recordedAt_idx" ON "GeofenceEvent"("geofenceId", "recordedAt");

-- CreateIndex
CREATE INDEX "OperationalIncident_organizationId_status_priority_idx" ON "OperationalIncident"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "OperationalIncident_serviceId_reportedAt_idx" ON "OperationalIncident"("serviceId", "reportedAt");

-- CreateIndex
CREATE INDEX "IncidentHistory_organizationId_incidentId_changedAt_idx" ON "IncidentHistory"("organizationId", "incidentId", "changedAt");

-- CreateIndex
CREATE INDEX "InternalNotification_organizationId_readAt_createdAt_idx" ON "InternalNotification"("organizationId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InternalNotification_organizationId_dedupeKey_key" ON "InternalNotification"("organizationId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "EtaEstimate" ADD CONSTRAINT "EtaEstimate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtaEstimate" ADD CONSTRAINT "EtaEstimate_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOperationalState" ADD CONSTRAINT "ServiceOperationalState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOperationalState" ADD CONSTRAINT "ServiceOperationalState_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceGeofence" ADD CONSTRAINT "ServiceGeofence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceGeofence" ADD CONSTRAINT "ServiceGeofence_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceEvent" ADD CONSTRAINT "GeofenceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceEvent" ADD CONSTRAINT "GeofenceEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceEvent" ADD CONSTRAINT "GeofenceEvent_geofenceId_fkey" FOREIGN KEY ("geofenceId") REFERENCES "ServiceGeofence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalIncident" ADD CONSTRAINT "OperationalIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalIncident" ADD CONSTRAINT "OperationalIncident_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalIncident" ADD CONSTRAINT "OperationalIncident_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentHistory" ADD CONSTRAINT "IncidentHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentHistory" ADD CONSTRAINT "IncidentHistory_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentHistory" ADD CONSTRAINT "IncidentHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNotification" ADD CONSTRAINT "InternalNotification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNotification" ADD CONSTRAINT "InternalNotification_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
