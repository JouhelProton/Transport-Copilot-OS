ALTER TYPE "ServiceEventType" ADD VALUE 'TRACKING_STARTED';
ALTER TYPE "ServiceEventType" ADD VALUE 'TRACKING_STOPPED';
ALTER TYPE "ServiceEventType" ADD VALUE 'TRACKING_EXPIRED';
CREATE TYPE "TrackingSessionStatus" AS ENUM ('ACTIVE', 'STOPPED', 'EXPIRED');

CREATE TABLE "TrackingSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "TrackingSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "stopReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CurrentPosition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy" DECIMAL(7,2) NOT NULL,
    "heading" DECIMAL(6,2),
    "speed" DECIMAL(8,2),
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MOBILE_GPS',
    "sampleId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CurrentPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LocationHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy" DECIMAL(7,2) NOT NULL,
    "heading" DECIMAL(6,2),
    "speed" DECIMAL(8,2),
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'MOBILE_GPS',
    "sampleId" TEXT NOT NULL,
    CONSTRAINT "LocationHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrackingSession_active_service_driver_key"
  ON "TrackingSession"("serviceId", "driverId", "status");
CREATE INDEX "TrackingSession_organizationId_serviceId_status_idx"
  ON "TrackingSession"("organizationId", "serviceId", "status");
CREATE INDEX "TrackingSession_driverId_status_idx"
  ON "TrackingSession"("driverId", "status");

CREATE UNIQUE INDEX "CurrentPosition_serviceId_key" ON "CurrentPosition"("serviceId");
CREATE UNIQUE INDEX "CurrentPosition_organizationId_serviceId_key"
  ON "CurrentPosition"("organizationId", "serviceId");
CREATE INDEX "CurrentPosition_organizationId_recordedAt_idx"
  ON "CurrentPosition"("organizationId", "recordedAt");
CREATE INDEX "CurrentPosition_driverId_recordedAt_idx"
  ON "CurrentPosition"("driverId", "recordedAt");

CREATE UNIQUE INDEX "LocationHistory_serviceId_sampleId_key"
  ON "LocationHistory"("serviceId", "sampleId");
CREATE INDEX "LocationHistory_organizationId_serviceId_recordedAt_idx"
  ON "LocationHistory"("organizationId", "serviceId", "recordedAt");
CREATE INDEX "LocationHistory_driverId_recordedAt_idx"
  ON "LocationHistory"("driverId", "recordedAt");

ALTER TABLE "TrackingSession" ADD CONSTRAINT "TrackingSession_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrackingSession" ADD CONSTRAINT "TrackingSession_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrackingSession" ADD CONSTRAINT "TrackingSession_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurrentPosition" ADD CONSTRAINT "CurrentPosition_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurrentPosition" ADD CONSTRAINT "CurrentPosition_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurrentPosition" ADD CONSTRAINT "CurrentPosition_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LocationHistory" ADD CONSTRAINT "LocationHistory_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LocationHistory" ADD CONSTRAINT "LocationHistory_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LocationHistory" ADD CONSTRAINT "LocationHistory_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
