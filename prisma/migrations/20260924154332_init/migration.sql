-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "unionRequired" BOOLEAN NOT NULL DEFAULT false,
    "inHouseRestrictions" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_rates" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'default',
    "rateType" TEXT NOT NULL DEFAULT 'DAY',
    "standardRate" DOUBLE PRECISION NOT NULL,
    "overtimeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "doubleTimeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "minimumCallHours" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "union" BOOLEAN NOT NULL DEFAULT false,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_items" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalDescription" TEXT,
    "sellRate" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 'FLAT',
    "defaultQuantity" INTEGER NOT NULL DEFAULT 1,
    "truckSpaceUnits" DOUBLE PRECISION,
    "crewNotes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "complexityLevel" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_package_items" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "equipmentItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "equipment_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_assumptions" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "flightRequired" BOOLEAN NOT NULL DEFAULT false,
    "driveNotes" TEXT,
    "hotelNightlyRate" DOUBLE PRECISION,
    "perDiemRate" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_assumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trucking_rates" (
    "id" TEXT NOT NULL,
    "originRegion" TEXT NOT NULL,
    "destinationNotes" TEXT,
    "rateType" TEXT NOT NULL DEFAULT 'FLAT',
    "rate" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trucking_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crew_rules" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ruleDsl" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crew_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "eventName" TEXT NOT NULL,
    "eventType" TEXT,
    "venueId" TEXT,
    "city" TEXT,
    "state" TEXT,
    "attendees" INTEGER,
    "roomSqft" INTEGER,
    "numGeneralSessionRooms" INTEGER,
    "numBreakoutRooms" INTEGER,
    "numSimultaneousBreakoutRooms" INTEGER,
    "showStartDate" TIMESTAMP(3),
    "setupDays" DOUBLE PRECISION,
    "rehearsalDays" DOUBLE PRECISION,
    "rehearsalHours" DOUBLE PRECISION,
    "showDays" DOUBLE PRECISION,
    "strikeDays" DOUBLE PRECISION,
    "dailySchedule" JSONB,
    "unionLabor" BOOLEAN NOT NULL DEFAULT false,
    "isTravelGig" BOOLEAN NOT NULL DEFAULT false,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "targetBudget" DOUBLE PRECISION,
    "specialRequirements" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_departments" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "complexityLevel" TEXT NOT NULL DEFAULT 'NONE',
    "requirementsText" TEXT,
    "structuredRequirements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_assumptions" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "assumptionText" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_assumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_line_items" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "equipmentItemId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "extendedPrice" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'RULE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_crew_items" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "hoursPerDay" DOUBLE PRECISION NOT NULL,
    "rateType" TEXT NOT NULL DEFAULT 'DAY',
    "rate" DOUBLE PRECISION NOT NULL,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeRate" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'HARD_RULE',
    "ruleId" TEXT,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_crew_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_comparables" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "historicalEventId" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "similarityBreakdown" JSONB NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_comparables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_results" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "lowPrice" DOUBLE PRECISION NOT NULL,
    "highPrice" DOUBLE PRECISION NOT NULL,
    "mostLikelyPrice" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "marginEstimate" DOUBLE PRECISION,
    "explanation" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_events" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "clientName" TEXT,
    "eventType" TEXT,
    "venueName" TEXT,
    "city" TEXT,
    "state" TEXT,
    "attendees" INTEGER,
    "roomSqft" INTEGER,
    "numGeneralSessionRooms" INTEGER,
    "numBreakoutRooms" INTEGER,
    "numSimultaneousBreakoutRooms" INTEGER,
    "setupDays" DOUBLE PRECISION,
    "rehearsalDays" DOUBLE PRECISION,
    "showDays" DOUBLE PRECISION,
    "strikeDays" DOUBLE PRECISION,
    "ledSizeSqft" DOUBLE PRECISION,
    "projectionUsed" BOOLEAN DEFAULT false,
    "cameraCount" INTEGER,
    "audioComplexity" TEXT,
    "videoComplexity" TEXT,
    "ledComplexity" TEXT,
    "lightingComplexity" TEXT,
    "scenicComplexity" TEXT,
    "unionLabor" BOOLEAN DEFAULT false,
    "eventDate" TIMESTAMP(3),
    "quotedAmount" DOUBLE PRECISION,
    "finalSellingPrice" DOUBLE PRECISION,
    "discountAmount" DOUBLE PRECISION,
    "internalCost" DOUBLE PRECISION,
    "grossMargin" DOUBLE PRECISION,
    "notes" TEXT,
    "dataQuality" TEXT NOT NULL DEFAULT 'VERIFIED',
    "importRowId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_event_equipment" (
    "id" TEXT NOT NULL,
    "historicalEventId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "historical_event_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_event_crew" (
    "id" TEXT NOT NULL,
    "historicalEventId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "hours" DOUBLE PRECISION,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "historical_event_crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learned_staffing_patterns" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "conditionText" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "matchCount" INTEGER NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "approvedRuleId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "learned_staffing_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_import_batches" (
    "id" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "columnMapping" JSONB,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historical_import_rows" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "mappedData" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "labor_positions_name_key" ON "labor_positions"("name");

-- CreateIndex
CREATE INDEX "labor_rates_positionId_region_idx" ON "labor_rates"("positionId", "region");

-- CreateIndex
CREATE INDEX "equipment_items_department_category_idx" ON "equipment_items"("department", "category");

-- CreateIndex
CREATE INDEX "equipment_packages_department_complexityLevel_idx" ON "equipment_packages"("department", "complexityLevel");

-- CreateIndex
CREATE UNIQUE INDEX "travel_assumptions_city_state_key" ON "travel_assumptions"("city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_departments_estimateId_department_key" ON "estimate_departments"("estimateId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "historical_events_importRowId_key" ON "historical_events"("importRowId");

-- AddForeignKey
ALTER TABLE "labor_rates" ADD CONSTRAINT "labor_rates_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "labor_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_package_items" ADD CONSTRAINT "equipment_package_items_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "equipment_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_package_items" ADD CONSTRAINT "equipment_package_items_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "equipment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_rules" ADD CONSTRAINT "crew_rules_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "labor_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_departments" ADD CONSTRAINT "estimate_departments_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_assumptions" ADD CONSTRAINT "estimate_assumptions_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "equipment_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_crew_items" ADD CONSTRAINT "estimate_crew_items_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_crew_items" ADD CONSTRAINT "estimate_crew_items_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "labor_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_crew_items" ADD CONSTRAINT "estimate_crew_items_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "crew_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_comparables" ADD CONSTRAINT "estimate_comparables_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_comparables" ADD CONSTRAINT "estimate_comparables_historicalEventId_fkey" FOREIGN KEY ("historicalEventId") REFERENCES "historical_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_results" ADD CONSTRAINT "estimate_results_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_events" ADD CONSTRAINT "historical_events_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "historical_import_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_event_equipment" ADD CONSTRAINT "historical_event_equipment_historicalEventId_fkey" FOREIGN KEY ("historicalEventId") REFERENCES "historical_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_event_crew" ADD CONSTRAINT "historical_event_crew_historicalEventId_fkey" FOREIGN KEY ("historicalEventId") REFERENCES "historical_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_event_crew" ADD CONSTRAINT "historical_event_crew_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "labor_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learned_staffing_patterns" ADD CONSTRAINT "learned_staffing_patterns_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "labor_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learned_staffing_patterns" ADD CONSTRAINT "learned_staffing_patterns_approvedRuleId_fkey" FOREIGN KEY ("approvedRuleId") REFERENCES "crew_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historical_import_rows" ADD CONSTRAINT "historical_import_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "historical_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
