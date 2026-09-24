export type TargetFieldType = "string" | "number" | "boolean" | "date" | "complexity";

export interface TargetField {
  key: string;
  label: string;
  type: TargetFieldType;
}

/** The HistoricalEvent fields a spreadsheet column can be mapped to. */
export const TARGET_FIELDS: TargetField[] = [
  { key: "eventName", label: "Event Name", type: "string" },
  { key: "clientName", label: "Client", type: "string" },
  { key: "eventType", label: "Event Type", type: "string" },
  { key: "venueName", label: "Venue", type: "string" },
  { key: "city", label: "City", type: "string" },
  { key: "state", label: "State", type: "string" },
  { key: "attendees", label: "Attendees", type: "number" },
  { key: "roomSqft", label: "Room Sqft", type: "number" },
  { key: "numGeneralSessionRooms", label: "General Session Rooms", type: "number" },
  { key: "numBreakoutRooms", label: "Breakout Rooms", type: "number" },
  { key: "numSimultaneousBreakoutRooms", label: "Simultaneous Breakout Rooms", type: "number" },
  { key: "setupDays", label: "Setup Days", type: "number" },
  { key: "rehearsalDays", label: "Rehearsal Days", type: "number" },
  { key: "showDays", label: "Show Days", type: "number" },
  { key: "strikeDays", label: "Strike Days", type: "number" },
  { key: "ledSizeSqft", label: "LED Size (sqft)", type: "number" },
  { key: "projectionUsed", label: "Projection Used", type: "boolean" },
  { key: "cameraCount", label: "Camera Count", type: "number" },
  { key: "audioComplexity", label: "Audio Complexity", type: "complexity" },
  { key: "videoComplexity", label: "Video Complexity", type: "complexity" },
  { key: "ledComplexity", label: "LED Complexity", type: "complexity" },
  { key: "lightingComplexity", label: "Lighting Complexity", type: "complexity" },
  { key: "scenicComplexity", label: "Scenic Complexity", type: "complexity" },
  { key: "unionLabor", label: "Union Labor", type: "boolean" },
  { key: "eventDate", label: "Event Date", type: "date" },
  { key: "quotedAmount", label: "Quoted Amount", type: "number" },
  { key: "finalSellingPrice", label: "Final Selling Price", type: "number" },
  { key: "discountAmount", label: "Discount Amount", type: "number" },
  { key: "internalCost", label: "Internal Cost", type: "number" },
  { key: "grossMargin", label: "Gross Margin", type: "number" },
  { key: "notes", label: "Notes", type: "string" },
];

const TARGET_FIELD_BY_KEY = new Map(TARGET_FIELDS.map((f) => [f.key, f]));

function coerce(value: unknown, type: TargetFieldType): unknown {
  if (value === null || value === undefined || value === "") return null;

  switch (type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      const normalized = String(value).trim().toLowerCase();
      return ["true", "yes", "y", "1"].includes(normalized);
    }
    case "date": {
      const d = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    case "complexity": {
      const normalized = String(value).trim().toUpperCase();
      return ["NONE", "SMALL", "MEDIUM", "LARGE", "ARENA"].includes(normalized) ? normalized : null;
    }
    default:
      return String(value).trim();
  }
}

/** columnMapping: { [spreadsheetHeader]: targetFieldKey | "" } */
export function applyMapping(rawData: Record<string, unknown>, columnMapping: Record<string, string>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [header, targetKey] of Object.entries(columnMapping)) {
    if (!targetKey) continue;
    const field = TARGET_FIELD_BY_KEY.get(targetKey);
    if (!field) continue;
    mapped[targetKey] = coerce(rawData[header], field.type);
  }
  return mapped;
}

/** Best-effort auto-mapping by fuzzy-matching header text to target field labels/keys. */
export function guessMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = TARGET_FIELDS.find(
      (f) => f.key.toLowerCase() === normalized || f.label.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized,
    );
    mapping[header] = match?.key ?? "";
  }
  return mapping;
}
