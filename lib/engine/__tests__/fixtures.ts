import type { EventProfile } from "../types";

export function emptyProfile(overrides: Partial<EventProfile> = {}): EventProfile {
  return {
    eventType: null,
    city: null,
    state: null,
    attendees: null,
    roomSqft: null,
    numGeneralSessionRooms: null,
    numBreakoutRooms: null,
    numSimultaneousBreakoutRooms: null,
    setupDays: null,
    rehearsalDays: null,
    showDays: null,
    strikeDays: null,
    ledSizeSqft: null,
    projectionUsed: null,
    cameraCount: null,
    audioComplexity: null,
    videoComplexity: null,
    ledComplexity: null,
    lightingComplexity: null,
    scenicComplexity: null,
    unionLabor: null,
    travelRequired: null,
    ...overrides,
  };
}
