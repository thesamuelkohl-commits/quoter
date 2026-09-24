/**
 * Seeds the database with representative OTL reference data (labor,
 * equipment, crew rules, travel/trucking assumptions) plus a generated set
 * of historical events so the comparable/crew/confidence engines have real
 * signal to work against before real OTL data is imported. Safe to re-run:
 * it clears its own tables first.
 *
 * WARNING: this also clears real data (historical shows, estimates) in
 * whatever database DATABASE_URL points to — do not run against the hosted
 * project without checking first.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, Prisma } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// --- deterministic PRNG so re-seeding produces the same sample data -------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const randFloat = (min: number, max: number, decimals = 2) => {
  const v = rand() * (max - min) + min;
  const p = 10 ** decimals;
  return Math.round(v * p) / p;
};
const pick = <T>(arr: readonly T[]): T => arr[randInt(0, arr.length - 1)];
const chance = (p: number) => rand() < p;

async function main() {
  await clearAll();

  const positions = await seedLaborPositions();
  await seedLaborRates(positions);
  await seedCrewRules(positions);

  const equipment = await seedEquipmentItems();
  await seedEquipmentPackages(equipment);

  const cities = await seedTravelAssumptions();
  await seedTruckingRates();
  await seedAppSettings();

  const clients = await seedClients();
  const venues = await seedVenues();

  await seedHistoricalEvents(positions, cities, venues, clients);

  console.log("Seed complete.");
}

async function clearAll() {
  await prisma.historicalImportRow.deleteMany();
  await prisma.historicalImportBatch.deleteMany();
  await prisma.estimateResult.deleteMany();
  await prisma.estimateComparable.deleteMany();
  await prisma.estimateCrewItem.deleteMany();
  await prisma.estimateLineItem.deleteMany();
  await prisma.estimateAssumption.deleteMany();
  await prisma.estimateDepartment.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.historicalEventCrew.deleteMany();
  await prisma.historicalEventEquipment.deleteMany();
  await prisma.historicalEvent.deleteMany();
  await prisma.learnedStaffingPattern.deleteMany();
  await prisma.equipmentPackageItem.deleteMany();
  await prisma.equipmentPackage.deleteMany();
  await prisma.equipmentItem.deleteMany();
  await prisma.crewRule.deleteMany();
  await prisma.laborRate.deleteMany();
  await prisma.laborPosition.deleteMany();
  await prisma.travelAssumption.deleteMany();
  await prisma.truckingRate.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.client.deleteMany();
  await prisma.venue.deleteMany();
}

// ---------------------------------------------------------------------------
// Labor
// ---------------------------------------------------------------------------

const POSITION_DEFS = [
  { name: "Project Manager", department: "LABOR", rateType: "DAY", rate: 950 },
  { name: "Technical Director", department: "LABOR", rateType: "DAY", rate: 850 },
  { name: "A1", department: "AUDIO", rateType: "DAY", rate: 750 },
  { name: "A2", department: "AUDIO", rateType: "DAY", rate: 550 },
  { name: "V1", department: "VIDEO", rateType: "DAY", rate: 750 },
  { name: "V2", department: "VIDEO", rateType: "DAY", rate: 550 },
  { name: "LED Technician", department: "LED", rateType: "DAY", rate: 650 },
  { name: "L1", department: "LIGHTING", rateType: "DAY", rate: 700 },
  { name: "L2", department: "LIGHTING", rateType: "DAY", rate: 500 },
  { name: "Camera Operator", department: "VIDEO", rateType: "DAY", rate: 550 },
  { name: "Graphics Operator", department: "VIDEO", rateType: "DAY", rate: 600 },
  { name: "Playback Operator", department: "VIDEO", rateType: "DAY", rate: 600 },
  { name: "Breakout Technician", department: "LABOR", rateType: "DAY", rate: 450 },
  { name: "Stage Manager", department: "LABOR", rateType: "DAY", rate: 600 },
  { name: "Stagehand", department: "LABOR", rateType: "HOURLY", rate: 45 },
  { name: "Setup Labor", department: "LABOR", rateType: "HOURLY", rate: 40 },
  { name: "Strike Labor", department: "LABOR", rateType: "HOURLY", rate: 40 },
  { name: "Truck Driver", department: "TRUCKING", rateType: "DAY", rate: 500 },
] as const;

async function seedLaborPositions() {
  const positions: Record<string, { id: string; department: string }> = {};
  for (const def of POSITION_DEFS) {
    const created = await prisma.laborPosition.create({
      data: { name: def.name, department: def.department, description: `${def.name} (${def.department.toLowerCase()})` },
    });
    positions[def.name] = { id: created.id, department: def.department };
  }
  return positions;
}

async function seedLaborRates(positions: Record<string, { id: string }>) {
  for (const def of POSITION_DEFS) {
    await prisma.laborRate.create({
      data: {
        positionId: positions[def.name].id,
        region: "default",
        rateType: def.rateType,
        standardRate: def.rate,
        overtimeMultiplier: 1.5,
        doubleTimeMultiplier: 2.0,
        minimumCallHours: def.rateType === "HOURLY" ? 8 : 0,
        union: false,
      },
    });
  }
}

async function seedCrewRules(positions: Record<string, { id: string }>) {
  await prisma.crewRule.create({
    data: {
      positionId: positions["Project Manager"].id,
      name: "One PM per show",
      description: "Every estimate carries exactly one Project Manager / Show Lead.",
      ruleDsl: { type: "fixed", quantity: 1 } satisfies Prisma.JsonObject,
      priority: 10,
    },
  });

  await prisma.crewRule.create({
    data: {
      positionId: positions["Breakout Technician"].id,
      name: "Breakout Technician Ratio",
      description:
        "OTL generally staffs approximately one breakout technician for every two simultaneous breakout rooms: ceiling(simultaneous_breakout_rooms / 2).",
      ruleDsl: { type: "ratio_ceiling", inputField: "numSimultaneousBreakoutRooms", divisor: 2 } satisfies Prisma.JsonObject,
      priority: 10,
    },
  });

  await prisma.crewRule.create({
    data: {
      positionId: positions["Camera Operator"].id,
      name: "One Camera Operator per Camera",
      description: "One dedicated camera operator per IMAG/broadcast camera requested.",
      ruleDsl: { type: "ratio_ceiling", inputField: "cameraCount", divisor: 1 } satisfies Prisma.JsonObject,
      priority: 10,
    },
  });

  const roomBasedLaborTiers = [
    { max: 5000, quantity: 2 },
    { max: 15000, quantity: 4 },
    { max: 30000, quantity: 6 },
  ];

  await prisma.crewRule.create({
    data: {
      positionId: positions["Setup Labor"].id,
      name: "Setup Labor by Room Size",
      description: "Setup crew headcount scales with total room square footage.",
      ruleDsl: {
        type: "threshold_table",
        inputField: "roomSqft",
        thresholds: roomBasedLaborTiers,
        aboveMaxQuantity: 8,
      } satisfies Prisma.JsonObject,
      priority: 5,
    },
  });

  await prisma.crewRule.create({
    data: {
      positionId: positions["Strike Labor"].id,
      name: "Strike Labor by Room Size",
      description: "Strike crew headcount scales with total room square footage (slightly leaner than setup).",
      ruleDsl: {
        type: "threshold_table",
        inputField: "roomSqft",
        thresholds: [
          { max: 5000, quantity: 2 },
          { max: 15000, quantity: 3 },
          { max: 30000, quantity: 5 },
        ],
        aboveMaxQuantity: 7,
      } satisfies Prisma.JsonObject,
      priority: 5,
    },
  });
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

type EquipmentDef = { name: string; category: string; sellRate: number; unit?: string; truckSpaceUnits?: number };

const EQUIPMENT_DEFS: Record<string, EquipmentDef[]> = {
  AUDIO: [
    { name: "Digital Audio Console", category: "Console", sellRate: 1200 },
    { name: "Line Array PA System", category: "Speakers", sellRate: 3500, truckSpaceUnits: 2 },
    { name: "Wireless Handheld Microphone", category: "Microphone", sellRate: 150 },
    { name: "Wireless Lavalier Microphone", category: "Microphone", sellRate: 150 },
    { name: "Stage Monitor Wedge", category: "Monitor", sellRate: 125 },
    { name: "DI Box", category: "Signal", sellRate: 25 },
  ],
  VIDEO: [
    { name: "Video Switcher", category: "Switcher", sellRate: 1800 },
    { name: "PTZ Camera", category: "Camera", sellRate: 450 },
    { name: "ENG Camera Package", category: "Camera", sellRate: 950, truckSpaceUnits: 1 },
    { name: "Confidence Monitor", category: "Monitor", sellRate: 150 },
    { name: "Video Distribution / Scan Converter", category: "Signal", sellRate: 300 },
    { name: "10K Lumen Projector", category: "Projector", sellRate: 1200, truckSpaceUnits: 1 },
    { name: "16x9 Projection Screen", category: "Screen", sellRate: 400 },
  ],
  STREAMING: [
    { name: "Streaming Encoder", category: "Encoding", sellRate: 600 },
    { name: "Dedicated Internet Circuit", category: "Bandwidth", sellRate: 800 },
    { name: "Streaming Platform License", category: "Platform", sellRate: 300 },
    { name: "Closed Captioning", category: "Accessibility", sellRate: 250 },
    { name: "Webcast Producer Console", category: "Production", sellRate: 500 },
  ],
  LED: [
    { name: "LED Wall Panel", category: "Panel", sellRate: 180 },
    { name: "LED Processor", category: "Processing", sellRate: 800 },
    { name: "LED Rigging Frame", category: "Rigging", sellRate: 600 },
  ],
  LIGHTING: [
    { name: "Moving Light Fixture", category: "Fixture", sellRate: 175 },
    { name: "LED Par Can", category: "Fixture", sellRate: 45 },
    { name: "Lighting Console", category: "Console", sellRate: 950 },
    { name: "Follow Spot", category: "Fixture", sellRate: 350 },
    { name: "Truss Section", category: "Rigging", sellRate: 85 },
    { name: "Haze Machine", category: "Effects", sellRate: 150 },
  ],
  SCENIC: [
    { name: "Modular Stage Deck (4x8)", category: "Staging", sellRate: 65 },
    { name: "Stage Skirt", category: "Staging", sellRate: 40 },
    { name: "Custom Backdrop", category: "Scenic Element", sellRate: 1200 },
    { name: "Podium", category: "Furniture", sellRate: 150 },
    { name: "Drape & Pipe Package", category: "Drape", sellRate: 300 },
  ],
  COMMUNICATIONS: [
    { name: "Intercom Base Station", category: "Intercom", sellRate: 300 },
    { name: "Intercom Beltpack", category: "Intercom", sellRate: 60 },
    { name: "Two-Way Radio", category: "Radio", sellRate: 35 },
    { name: "IFB Pack", category: "Intercom", sellRate: 75 },
  ],
  RIGGING: [
    { name: "Motor / Hoist", category: "Motor", sellRate: 400 },
    { name: "Rigging Point Engineering", category: "Engineering", sellRate: 600 },
    { name: "Ground Support Truss Tower", category: "Ground Support", sellRate: 900 },
  ],
  TRUCKING: [
    { name: "26' Box Truck", category: "Truck", sellRate: 1800 },
    { name: "53' Semi Trailer", category: "Truck", sellRate: 3200 },
    { name: "Local Cartage", category: "Truck", sellRate: 600 },
  ],
  TRAVEL: [
    { name: "Round-Trip Flight", category: "Airfare", sellRate: 450, unit: "PER_PERSON" },
    { name: "Hotel Night", category: "Lodging", sellRate: 189, unit: "PER_PERSON" },
    { name: "Per Diem Day", category: "Per Diem", sellRate: 75, unit: "PER_PERSON" },
    { name: "Rental Van", category: "Ground Transport", sellRate: 150 },
  ],
  OTHER: [
    { name: "Production Insurance Rider", category: "Insurance", sellRate: 300 },
    { name: "Miscellaneous Consumables", category: "Consumables", sellRate: 200 },
    { name: "Site Survey", category: "Services", sellRate: 500 },
  ],
  // Add-ons are individually toggled flat-fee line items, not a Small/Medium/Large/Arena
  // package — see the Add-Ons picker on the New Estimate form.
  ADDONS: [
    { name: "Podcast Recording", category: "Add-On", sellRate: 2500 },
    { name: "Graphics Support", category: "Add-On", sellRate: 6000 },
  ],
};

async function seedEquipmentItems() {
  const byDeptAndName: Record<string, Record<string, string>> = {};
  for (const [department, defs] of Object.entries(EQUIPMENT_DEFS)) {
    byDeptAndName[department] = {};
    for (const def of defs) {
      const created = await prisma.equipmentItem.create({
        data: {
          department,
          category: def.category,
          name: def.name,
          sellRate: def.sellRate,
          cost: Math.round(def.sellRate * 0.6),
          unit: def.unit ?? "FLAT",
          truckSpaceUnits: def.truckSpaceUnits ?? null,
        },
      });
      byDeptAndName[department][def.name] = created.id;
    }
  }
  return byDeptAndName;
}

type PackageItemSpec = { name: string; quantity: number };
const PACKAGE_DEFS: Record<string, Record<string, PackageItemSpec[]>> = {
  AUDIO: {
    SMALL: [
      { name: "Wireless Handheld Microphone", quantity: 2 },
      { name: "DI Box", quantity: 2 },
      { name: "Stage Monitor Wedge", quantity: 2 },
    ],
    MEDIUM: [
      { name: "Digital Audio Console", quantity: 1 },
      { name: "Line Array PA System", quantity: 1 },
      { name: "Wireless Handheld Microphone", quantity: 4 },
      { name: "Wireless Lavalier Microphone", quantity: 2 },
      { name: "Stage Monitor Wedge", quantity: 4 },
      { name: "DI Box", quantity: 4 },
    ],
    LARGE: [
      { name: "Digital Audio Console", quantity: 1 },
      { name: "Line Array PA System", quantity: 2 },
      { name: "Wireless Handheld Microphone", quantity: 6 },
      { name: "Wireless Lavalier Microphone", quantity: 4 },
      { name: "Stage Monitor Wedge", quantity: 6 },
      { name: "DI Box", quantity: 6 },
    ],
    ARENA: [
      { name: "Digital Audio Console", quantity: 2 },
      { name: "Line Array PA System", quantity: 4 },
      { name: "Wireless Handheld Microphone", quantity: 10 },
      { name: "Wireless Lavalier Microphone", quantity: 8 },
      { name: "Stage Monitor Wedge", quantity: 10 },
      { name: "DI Box", quantity: 12 },
    ],
  },
  VIDEO: {
    SMALL: [
      { name: "Confidence Monitor", quantity: 2 },
      { name: "10K Lumen Projector", quantity: 1 },
      { name: "16x9 Projection Screen", quantity: 1 },
    ],
    MEDIUM: [
      { name: "Video Switcher", quantity: 1 },
      { name: "PTZ Camera", quantity: 2 },
      { name: "10K Lumen Projector", quantity: 2 },
      { name: "16x9 Projection Screen", quantity: 2 },
      { name: "Confidence Monitor", quantity: 2 },
    ],
    LARGE: [
      { name: "Video Switcher", quantity: 1 },
      { name: "ENG Camera Package", quantity: 2 },
      { name: "PTZ Camera", quantity: 2 },
      { name: "10K Lumen Projector", quantity: 2 },
      { name: "16x9 Projection Screen", quantity: 2 },
      { name: "Video Distribution / Scan Converter", quantity: 1 },
    ],
    ARENA: [
      { name: "Video Switcher", quantity: 2 },
      { name: "ENG Camera Package", quantity: 5 },
      { name: "PTZ Camera", quantity: 4 },
      { name: "10K Lumen Projector", quantity: 4 },
      { name: "16x9 Projection Screen", quantity: 4 },
      { name: "Video Distribution / Scan Converter", quantity: 2 },
      { name: "Confidence Monitor", quantity: 6 },
    ],
  },
  STREAMING: {
    SMALL: [{ name: "Streaming Encoder", quantity: 1 }],
    MEDIUM: [
      { name: "Streaming Encoder", quantity: 1 },
      { name: "Dedicated Internet Circuit", quantity: 1 },
      { name: "Streaming Platform License", quantity: 1 },
    ],
    LARGE: [
      { name: "Streaming Encoder", quantity: 2 },
      { name: "Dedicated Internet Circuit", quantity: 1 },
      { name: "Streaming Platform License", quantity: 1 },
      { name: "Closed Captioning", quantity: 1 },
      { name: "Webcast Producer Console", quantity: 1 },
    ],
    ARENA: [
      { name: "Streaming Encoder", quantity: 4 },
      { name: "Dedicated Internet Circuit", quantity: 2 },
      { name: "Streaming Platform License", quantity: 2 },
      { name: "Closed Captioning", quantity: 2 },
      { name: "Webcast Producer Console", quantity: 2 },
    ],
  },
  LED: {
    SMALL: [
      { name: "LED Wall Panel", quantity: 24 },
      { name: "LED Processor", quantity: 1 },
    ],
    MEDIUM: [
      { name: "LED Wall Panel", quantity: 54 },
      { name: "LED Processor", quantity: 1 },
      { name: "LED Rigging Frame", quantity: 1 },
    ],
    LARGE: [
      { name: "LED Wall Panel", quantity: 96 },
      { name: "LED Processor", quantity: 2 },
      { name: "LED Rigging Frame", quantity: 2 },
    ],
    ARENA: [
      { name: "LED Wall Panel", quantity: 200 },
      { name: "LED Processor", quantity: 4 },
      { name: "LED Rigging Frame", quantity: 4 },
    ],
  },
  LIGHTING: {
    SMALL: [
      { name: "LED Par Can", quantity: 12 },
      { name: "Lighting Console", quantity: 1 },
      { name: "Truss Section", quantity: 2 },
    ],
    MEDIUM: [
      { name: "Moving Light Fixture", quantity: 8 },
      { name: "LED Par Can", quantity: 16 },
      { name: "Lighting Console", quantity: 1 },
      { name: "Truss Section", quantity: 4 },
      { name: "Haze Machine", quantity: 1 },
    ],
    LARGE: [
      { name: "Moving Light Fixture", quantity: 16 },
      { name: "LED Par Can", quantity: 24 },
      { name: "Lighting Console", quantity: 1 },
      { name: "Truss Section", quantity: 8 },
      { name: "Follow Spot", quantity: 2 },
      { name: "Haze Machine", quantity: 2 },
    ],
    ARENA: [
      { name: "Moving Light Fixture", quantity: 36 },
      { name: "LED Par Can", quantity: 48 },
      { name: "Lighting Console", quantity: 2 },
      { name: "Truss Section", quantity: 16 },
      { name: "Follow Spot", quantity: 4 },
      { name: "Haze Machine", quantity: 4 },
    ],
  },
  SCENIC: {
    SMALL: [
      { name: "Modular Stage Deck (4x8)", quantity: 8 },
      { name: "Podium", quantity: 1 },
      { name: "Stage Skirt", quantity: 1 },
    ],
    MEDIUM: [
      { name: "Modular Stage Deck (4x8)", quantity: 16 },
      { name: "Custom Backdrop", quantity: 1 },
      { name: "Podium", quantity: 1 },
      { name: "Drape & Pipe Package", quantity: 1 },
    ],
    LARGE: [
      { name: "Modular Stage Deck (4x8)", quantity: 24 },
      { name: "Custom Backdrop", quantity: 2 },
      { name: "Drape & Pipe Package", quantity: 2 },
      { name: "Podium", quantity: 1 },
    ],
    ARENA: [
      { name: "Modular Stage Deck (4x8)", quantity: 48 },
      { name: "Custom Backdrop", quantity: 4 },
      { name: "Drape & Pipe Package", quantity: 4 },
      { name: "Podium", quantity: 2 },
    ],
  },
  COMMUNICATIONS: {
    SMALL: [{ name: "Two-Way Radio", quantity: 4 }],
    MEDIUM: [
      { name: "Intercom Base Station", quantity: 1 },
      { name: "Intercom Beltpack", quantity: 6 },
      { name: "Two-Way Radio", quantity: 4 },
    ],
    LARGE: [
      { name: "Intercom Base Station", quantity: 2 },
      { name: "Intercom Beltpack", quantity: 12 },
      { name: "Two-Way Radio", quantity: 8 },
      { name: "IFB Pack", quantity: 2 },
    ],
    ARENA: [
      { name: "Intercom Base Station", quantity: 4 },
      { name: "Intercom Beltpack", quantity: 24 },
      { name: "Two-Way Radio", quantity: 16 },
      { name: "IFB Pack", quantity: 4 },
    ],
  },
  RIGGING: {
    SMALL: [{ name: "Ground Support Truss Tower", quantity: 2 }],
    MEDIUM: [
      { name: "Motor / Hoist", quantity: 4 },
      { name: "Rigging Point Engineering", quantity: 1 },
    ],
    LARGE: [
      { name: "Motor / Hoist", quantity: 8 },
      { name: "Rigging Point Engineering", quantity: 1 },
      { name: "Ground Support Truss Tower", quantity: 4 },
    ],
    ARENA: [
      { name: "Motor / Hoist", quantity: 16 },
      { name: "Rigging Point Engineering", quantity: 2 },
      { name: "Ground Support Truss Tower", quantity: 8 },
    ],
  },
  TRUCKING: {
    SMALL: [{ name: "Local Cartage", quantity: 1 }],
    MEDIUM: [{ name: "26' Box Truck", quantity: 1 }],
    LARGE: [
      { name: "53' Semi Trailer", quantity: 1 },
      { name: "26' Box Truck", quantity: 1 },
    ],
    ARENA: [
      { name: "53' Semi Trailer", quantity: 3 },
      { name: "26' Box Truck", quantity: 2 },
    ],
  },
  TRAVEL: {
    SMALL: [{ name: "Rental Van", quantity: 1 }],
    MEDIUM: [
      { name: "Round-Trip Flight", quantity: 4 },
      { name: "Hotel Night", quantity: 8 },
      { name: "Per Diem Day", quantity: 8 },
    ],
    LARGE: [
      { name: "Round-Trip Flight", quantity: 8 },
      { name: "Hotel Night", quantity: 16 },
      { name: "Per Diem Day", quantity: 16 },
      { name: "Rental Van", quantity: 2 },
    ],
    ARENA: [
      { name: "Round-Trip Flight", quantity: 16 },
      { name: "Hotel Night", quantity: 32 },
      { name: "Per Diem Day", quantity: 32 },
      { name: "Rental Van", quantity: 4 },
    ],
  },
  OTHER: {
    SMALL: [{ name: "Miscellaneous Consumables", quantity: 1 }],
    MEDIUM: [
      { name: "Miscellaneous Consumables", quantity: 1 },
      { name: "Site Survey", quantity: 1 },
    ],
    LARGE: [
      { name: "Production Insurance Rider", quantity: 1 },
      { name: "Miscellaneous Consumables", quantity: 1 },
      { name: "Site Survey", quantity: 1 },
    ],
    ARENA: [
      { name: "Production Insurance Rider", quantity: 2 },
      { name: "Miscellaneous Consumables", quantity: 2 },
      { name: "Site Survey", quantity: 1 },
    ],
  },
};

async function seedEquipmentPackages(equipmentIds: Record<string, Record<string, string>>) {
  for (const [department, tiers] of Object.entries(PACKAGE_DEFS)) {
    for (const [complexityLevel, items] of Object.entries(tiers)) {
      const pkg = await prisma.equipmentPackage.create({
        data: {
          name: `${titleCase(department)}: ${titleCase(complexityLevel)}`,
          department,
          complexityLevel,
          description: `Default ${complexityLevel.toLowerCase()} equipment package for ${department}.`,
        },
      });
      for (const item of items) {
        const equipmentItemId = equipmentIds[department]?.[item.name];
        if (!equipmentItemId) throw new Error(`Missing equipment item ${department}/${item.name}`);
        await prisma.equipmentPackageItem.create({
          data: { packageId: pkg.id, equipmentItemId, quantity: item.quantity },
        });
      }
    }
  }
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Travel / trucking / settings
// ---------------------------------------------------------------------------

const CITIES = [
  { city: "Nashville", state: "TN", flightRequired: false, hotelNightlyRate: 179, perDiemRate: 65 },
  { city: "Atlanta", state: "GA", flightRequired: false, hotelNightlyRate: 189, perDiemRate: 68 },
  { city: "Chicago", state: "IL", flightRequired: true, hotelNightlyRate: 229, perDiemRate: 75 },
  { city: "Las Vegas", state: "NV", flightRequired: true, hotelNightlyRate: 199, perDiemRate: 72 },
  { city: "Orlando", state: "FL", flightRequired: true, hotelNightlyRate: 195, perDiemRate: 70 },
  { city: "Dallas", state: "TX", flightRequired: true, hotelNightlyRate: 179, perDiemRate: 68 },
] as const;

async function seedTravelAssumptions() {
  for (const c of CITIES) {
    await prisma.travelAssumption.create({
      data: {
        city: c.city,
        state: c.state,
        flightRequired: c.flightRequired,
        hotelNightlyRate: c.hotelNightlyRate,
        perDiemRate: c.perDiemRate,
        notes: c.flightRequired ? "Requires air travel from Nashville home base." : "Drivable from Nashville home base.",
      },
    });
  }
  return CITIES;
}

async function seedTruckingRates() {
  const regions = [
    { originRegion: "Southeast", rate: 1200 },
    { originRegion: "Midwest", rate: 1800 },
    { originRegion: "West / Mountain", rate: 3200 },
    { originRegion: "Northeast", rate: 2400 },
  ];
  for (const r of regions) {
    await prisma.truckingRate.create({
      data: { originRegion: r.originRegion, rateType: "FLAT", rate: r.rate, notes: `Flat round-trip estimate from Nashville to ${r.originRegion}.` },
    });
  }
}

async function seedAppSettings() {
  await prisma.appSetting.create({
    data: { key: "default_target_margin_percent", value: 35, description: "Target gross margin percentage used as a planning guide." },
  });
  await prisma.appSetting.create({
    data: { key: "minimum_recommended_margin_percent", value: 20, description: "Floor margin percentage before a discount requires extra approval." },
  });
}

// ---------------------------------------------------------------------------
// Clients / venues
// ---------------------------------------------------------------------------

const CLIENT_NAMES = [
  "Acme Corporation",
  "Meridian Health Systems",
  "Nashville Tech Summit Inc.",
  "Crestview Financial Group",
  "Southeastern Grocers Association",
  "Brightline Software",
  "Lonestar Energy Partners",
];

async function seedClients() {
  const clients: Record<string, string> = {};
  for (const name of CLIENT_NAMES) {
    const created = await prisma.client.create({ data: { name } });
    clients[name] = created.id;
  }
  return clients;
}

const VENUE_DEFS = [
  { name: "Music City Center", city: "Nashville", state: "TN" },
  { name: "Gaylord Opryland Resort & Convention Center", city: "Nashville", state: "TN" },
  { name: "Georgia World Congress Center", city: "Atlanta", state: "GA" },
  { name: "McCormick Place", city: "Chicago", state: "IL" },
  { name: "Mandalay Bay Convention Center", city: "Las Vegas", state: "NV" },
  { name: "Orange County Convention Center", city: "Orlando", state: "FL" },
  { name: "Kay Bailey Hutchison Convention Center", city: "Dallas", state: "TX" },
] as const;

async function seedVenues() {
  const venues: Record<string, string> = {};
  for (const v of VENUE_DEFS) {
    const created = await prisma.venue.create({ data: { name: v.name, city: v.city, state: v.state } });
    venues[v.name] = created.id;
  }
  return venues;
}

// ---------------------------------------------------------------------------
// Historical events (generated, deterministic)
// ---------------------------------------------------------------------------

type Complexity = "NONE" | "SMALL" | "MEDIUM" | "LARGE" | "ARENA";
const COMPLEXITY_ORDER: Complexity[] = ["NONE", "SMALL", "MEDIUM", "LARGE", "ARENA"];

interface Archetype {
  eventType: string;
  attendees: [number, number];
  roomSqftPerAttendee: [number, number];
  generalSessionRooms: [number, number];
  breakoutRooms: [number, number];
  simultaneousBreakoutShare: [number, number]; // fraction of breakoutRooms that run simultaneously
  setupDays: [number, number];
  showDays: [number, number];
  strikeDays: [number, number];
  ledSizeSqft: [number, number] | null;
  projectionProb: number;
  cameraCount: [number, number];
  audio: Complexity;
  video: Complexity;
  led: Complexity;
  lighting: Complexity;
  scenic: Complexity;
  unionProb: number;
  pricePerAttendee: [number, number];
}

const ARCHETYPES: Archetype[] = [
  {
    eventType: "Corporate Conference",
    attendees: [300, 900],
    roomSqftPerAttendee: [18, 26],
    generalSessionRooms: [1, 1],
    breakoutRooms: [4, 10],
    simultaneousBreakoutShare: [0.5, 0.8],
    setupDays: [2, 3],
    showDays: [2, 3],
    strikeDays: [1, 1],
    ledSizeSqft: [200, 500],
    projectionProb: 0.4,
    cameraCount: [2, 4],
    audio: "MEDIUM",
    video: "MEDIUM",
    led: "MEDIUM",
    lighting: "MEDIUM",
    scenic: "SMALL",
    unionProb: 0.3,
    pricePerAttendee: [55, 85],
  },
  {
    eventType: "Product Launch",
    attendees: [150, 500],
    roomSqftPerAttendee: [22, 32],
    generalSessionRooms: [1, 1],
    breakoutRooms: [0, 2],
    simultaneousBreakoutShare: [0.5, 1],
    setupDays: [3, 4],
    showDays: [1, 2],
    strikeDays: [1, 2],
    ledSizeSqft: [300, 800],
    projectionProb: 0.2,
    cameraCount: [3, 6],
    audio: "LARGE",
    video: "LARGE",
    led: "LARGE",
    lighting: "LARGE",
    scenic: "MEDIUM",
    unionProb: 0.4,
    pricePerAttendee: [110, 180],
  },
  {
    eventType: "Sales Kickoff",
    attendees: [200, 700],
    roomSqftPerAttendee: [16, 22],
    generalSessionRooms: [1, 1],
    breakoutRooms: [3, 8],
    simultaneousBreakoutShare: [0.4, 0.7],
    setupDays: [1, 2],
    showDays: [2, 3],
    strikeDays: [1, 1],
    ledSizeSqft: [150, 350],
    projectionProb: 0.5,
    cameraCount: [1, 3],
    audio: "MEDIUM",
    video: "MEDIUM",
    led: "SMALL",
    lighting: "MEDIUM",
    scenic: "SMALL",
    unionProb: 0.2,
    pricePerAttendee: [50, 75],
  },
  {
    eventType: "Annual Meeting / Trade Show",
    attendees: [800, 3000],
    roomSqftPerAttendee: [14, 20],
    generalSessionRooms: [1, 2],
    breakoutRooms: [6, 16],
    simultaneousBreakoutShare: [0.4, 0.6],
    setupDays: [3, 5],
    showDays: [2, 4],
    strikeDays: [1, 2],
    ledSizeSqft: [400, 1000],
    projectionProb: 0.3,
    cameraCount: [3, 8],
    audio: "ARENA",
    video: "ARENA",
    led: "ARENA",
    lighting: "ARENA",
    scenic: "LARGE",
    unionProb: 0.6,
    pricePerAttendee: [45, 70],
  },
  {
    eventType: "Gala / Awards Dinner",
    attendees: [150, 600],
    roomSqftPerAttendee: [20, 30],
    generalSessionRooms: [1, 1],
    breakoutRooms: [0, 1],
    simultaneousBreakoutShare: [0.5, 1],
    setupDays: [2, 3],
    showDays: [1, 1],
    strikeDays: [1, 1],
    ledSizeSqft: null,
    projectionProb: 0.15,
    cameraCount: [0, 2],
    audio: "MEDIUM",
    video: "SMALL",
    led: "NONE",
    lighting: "LARGE",
    scenic: "LARGE",
    unionProb: 0.35,
    pricePerAttendee: [90, 150],
  },
  {
    eventType: "Board Retreat",
    attendees: [30, 120],
    roomSqftPerAttendee: [25, 40],
    generalSessionRooms: [1, 1],
    breakoutRooms: [0, 2],
    simultaneousBreakoutShare: [1, 1],
    setupDays: [1, 1],
    showDays: [1, 2],
    strikeDays: [1, 1],
    ledSizeSqft: null,
    projectionProb: 0.6,
    cameraCount: [0, 1],
    audio: "SMALL",
    video: "SMALL",
    led: "NONE",
    lighting: "SMALL",
    scenic: "NONE",
    unionProb: 0.1,
    pricePerAttendee: [120, 220],
  },
];

function complexityToLabel(c: Complexity): string {
  return c;
}

function randomDateWithinYears(years: number): Date {
  const now = Date.now();
  const past = now - years * 365 * 24 * 60 * 60 * 1000;
  return new Date(past + rand() * (now - past));
}

async function seedHistoricalEvents(
  positions: Record<string, { id: string }>,
  cities: readonly { city: string; state: string }[],
  venues: Record<string, string>,
  clients: Record<string, string>,
) {
  const venueEntries = Object.entries(venues);
  const clientNames = Object.keys(clients);

  let eventCounter = 0;
  for (const archetype of ARCHETYPES) {
    const instancesPerArchetype = 3;
    for (let i = 0; i < instancesPerArchetype; i++) {
      eventCounter++;
      const [venueName] = pick(venueEntries);
      const venueLocation = VENUE_DEFS.find((v) => v.name === venueName)!;
      const clientName = pick(clientNames);

      const attendees = randInt(...archetype.attendees);
      const roomSqft = Math.round(attendees * randFloat(...archetype.roomSqftPerAttendee, 1));
      const numGeneralSessionRooms = randInt(...archetype.generalSessionRooms);
      const numBreakoutRooms = randInt(...archetype.breakoutRooms);
      const numSimultaneousBreakoutRooms =
        numBreakoutRooms === 0 ? 0 : Math.max(1, Math.round(numBreakoutRooms * randFloat(...archetype.simultaneousBreakoutShare, 2)));
      const setupDays = randInt(...archetype.setupDays);
      const showDays = randInt(...archetype.showDays);
      const strikeDays = randInt(...archetype.strikeDays);
      const ledSizeSqft = archetype.ledSizeSqft ? randInt(...archetype.ledSizeSqft) : null;
      const projectionUsed = chance(archetype.projectionProb);
      const cameraCount = randInt(...archetype.cameraCount);
      const unionLabor = chance(archetype.unionProb);
      const eventDate = randomDateWithinYears(3);

      const pricePerAttendee = randFloat(...archetype.pricePerAttendee, 2);
      const finalSellingPrice = Math.round(attendees * pricePerAttendee * randFloat(0.92, 1.08, 3));
      const discountAmount = chance(0.4) ? Math.round(finalSellingPrice * randFloat(0.02, 0.08, 3)) : 0;
      const quotedAmount = finalSellingPrice + discountAmount;
      const internalCost = Math.round(finalSellingPrice * randFloat(0.55, 0.7, 3));
      const grossMargin = finalSellingPrice - internalCost;

      const event = await prisma.historicalEvent.create({
        data: {
          eventName: `${archetype.eventType} — ${clientName} #${eventCounter}`,
          clientName,
          eventType: archetype.eventType,
          venueName,
          city: venueLocation.city,
          state: venueLocation.state,
          attendees,
          roomSqft,
          numGeneralSessionRooms,
          numBreakoutRooms,
          numSimultaneousBreakoutRooms,
          setupDays,
          rehearsalDays: chance(0.3) ? 1 : 0,
          showDays,
          strikeDays,
          ledSizeSqft: ledSizeSqft ?? undefined,
          projectionUsed,
          cameraCount,
          audioComplexity: complexityToLabel(archetype.audio),
          videoComplexity: complexityToLabel(archetype.video),
          ledComplexity: complexityToLabel(archetype.led),
          lightingComplexity: complexityToLabel(archetype.lighting),
          scenicComplexity: complexityToLabel(archetype.scenic),
          unionLabor,
          eventDate,
          quotedAmount,
          finalSellingPrice,
          discountAmount,
          internalCost,
          grossMargin,
          dataQuality: "VERIFIED",
          notes: `Generated sample record for archetype "${archetype.eventType}".`,
        },
      });

      await seedHistoricalEquipment(event.id, archetype);
      await seedHistoricalCrew(event.id, positions, {
        numSimultaneousBreakoutRooms,
        cameraCount,
        roomSqft,
        audio: archetype.audio,
        video: archetype.video,
        led: archetype.led,
        lighting: archetype.lighting,
      });
    }
  }
}

async function seedHistoricalEquipment(historicalEventId: string, archetype: Archetype) {
  const rows: { department: string; category: string; name: string; quantity: number }[] = [];
  const complexityToTier = (c: Complexity): keyof (typeof PACKAGE_DEFS)["AUDIO"] | null =>
    c === "NONE" ? null : c;

  const deptComplexity: [string, Complexity][] = [
    ["AUDIO", archetype.audio],
    ["VIDEO", archetype.video],
    ["LED", archetype.led],
    ["LIGHTING", archetype.lighting],
    ["SCENIC", archetype.scenic],
  ];

  for (const [department, complexity] of deptComplexity) {
    const tier = complexityToTier(complexity);
    if (!tier) continue;
    const items = PACKAGE_DEFS[department][tier];
    for (const item of items) {
      rows.push({ department, category: "Equipment", name: item.name, quantity: item.quantity });
    }
  }

  if (rows.length > 0) {
    await prisma.historicalEventEquipment.createMany({
      data: rows.map((r) => ({ historicalEventId, ...r })),
    });
  }
}

async function seedHistoricalCrew(
  historicalEventId: string,
  positions: Record<string, { id: string }>,
  ctx: {
    numSimultaneousBreakoutRooms: number;
    cameraCount: number;
    roomSqft: number;
    audio: Complexity;
    video: Complexity;
    led: Complexity;
    lighting: Complexity;
  },
) {
  const rows: { positionName: string; quantity: number; days: number; hours: number }[] = [];

  // Normal crew works a 12-hour day before overtime (matches STANDARD_HOURS_PER_DAY
  // in lib/engine/pricing-engine.ts). Setup/Strike/load-in-load-out labor is a
  // shorter single shift, not a full show day.
  rows.push({ positionName: "Project Manager", quantity: 1, days: 3, hours: 12 });

  if (ctx.numSimultaneousBreakoutRooms > 0) {
    rows.push({
      positionName: "Breakout Technician",
      quantity: Math.ceil(ctx.numSimultaneousBreakoutRooms / 2),
      days: 2,
      hours: 8,
    });
  }

  if (ctx.cameraCount > 0) {
    rows.push({ positionName: "Camera Operator", quantity: ctx.cameraCount, days: 2, hours: 12 });
  }

  if (ctx.audio !== "NONE") {
    rows.push({ positionName: "A1", quantity: 1, days: 3, hours: 12 });
    if (COMPLEXITY_ORDER.indexOf(ctx.audio) >= COMPLEXITY_ORDER.indexOf("MEDIUM") && chance(0.75)) {
      rows.push({ positionName: "A2", quantity: 1, days: 2, hours: 12 });
    }
  }

  if (ctx.video !== "NONE") {
    if (chance(0.85)) rows.push({ positionName: "V1", quantity: 1, days: 3, hours: 12 });
    if (COMPLEXITY_ORDER.indexOf(ctx.video) >= COMPLEXITY_ORDER.indexOf("LARGE") && chance(0.6)) {
      rows.push({ positionName: "Graphics Operator", quantity: 1, days: 2, hours: 12 });
      rows.push({ positionName: "Playback Operator", quantity: 1, days: 2, hours: 12 });
    }
  }

  if (ctx.led !== "NONE" && chance(0.9)) {
    rows.push({ positionName: "LED Technician", quantity: COMPLEXITY_ORDER.indexOf(ctx.led) >= COMPLEXITY_ORDER.indexOf("LARGE") ? 2 : 1, days: 3, hours: 12 });
  }

  if (ctx.lighting !== "NONE" && chance(0.85)) {
    rows.push({ positionName: "L1", quantity: 1, days: 3, hours: 12 });
  }

  const setupTier = ctx.roomSqft <= 5000 ? 2 : ctx.roomSqft <= 15000 ? 4 : ctx.roomSqft <= 30000 ? 6 : 8;
  rows.push({ positionName: "Setup Labor", quantity: setupTier, days: 1, hours: 8 });

  const strikeTier = ctx.roomSqft <= 5000 ? 2 : ctx.roomSqft <= 15000 ? 3 : ctx.roomSqft <= 30000 ? 5 : 7;
  rows.push({ positionName: "Strike Labor", quantity: strikeTier, days: 1, hours: 8 });

  if (chance(0.6)) rows.push({ positionName: "Stage Manager", quantity: 1, days: 3, hours: 12 });
  if (chance(0.4)) rows.push({ positionName: "Technical Director", quantity: 1, days: 2, hours: 12 });
  rows.push({ positionName: "Truck Driver", quantity: 1, days: 2, hours: 8 });

  await prisma.historicalEventCrew.createMany({
    data: rows.map((r) => ({
      historicalEventId,
      positionId: positions[r.positionName].id,
      quantity: r.quantity,
      days: r.days,
      hours: r.hours,
      overtimeHours: r.hours > 12 ? (r.hours - 12) * r.days : 0,
    })),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
