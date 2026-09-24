import type { ComplexityLevel, Department } from "@/lib/engine/types";

/**
 * Real reference photos for specific department/tier combinations, used in
 * place of the abstract TierIcon when available. Add more as OTL supplies
 * representative show photos for other departments/tiers.
 */
const TIER_PHOTOS: Partial<Record<Department, Partial<Record<ComplexityLevel, string>>>> = {
  AUDIO: { SMALL: "/images/tiers/audio-small.jpg", MEDIUM: "/images/tiers/audio-medium.jpg", LARGE: "/images/tiers/audio-large.jpg" },
  LED: { MEDIUM: "/images/tiers/led-medium.jpg" },
  LIGHTING: { MEDIUM: "/images/tiers/lighting-medium.jpg", LARGE: "/images/tiers/lighting-large.jpg" },
  VIDEO: { SMALL: "/images/tiers/video-small.jpg", MEDIUM: "/images/tiers/video-medium.jpg", ARENA: "/images/tiers/video-arena.jpg" },
};

export function tierPhoto(department: Department | undefined, level: ComplexityLevel): string | undefined {
  if (!department) return undefined;
  return TIER_PHOTOS[department]?.[level];
}

/**
 * Small pictographs standing in for event scale (None/Small/Medium/Large/Arena)
 * on the department-requirement pickers. Abstract "stage + crowd" motif that
 * grows with tier, drawn with currentColor so it follows the picker's
 * selected/unselected text color automatically.
 */
export function TierIcon({ level, className = "" }: { level: ComplexityLevel; className?: string }) {
  switch (level) {
    case "NONE":
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="6" y="12" width="20" height="8" rx="1.5" strokeDasharray="3 3" />
          <line x1="9" y1="9" x2="23" y2="23" strokeDasharray="3 3" />
        </svg>
      );
    case "SMALL":
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="10" y="14" width="12" height="6" rx="1" />
          <circle cx="12" cy="24" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="16" cy="25" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="20" cy="24" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "MEDIUM":
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="7" y="11" width="18" height="7" rx="1" />
          <circle cx="9" cy="22" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="13" cy="23.5" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="17" cy="22" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="21" cy="23.5" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="25" cy="22" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "LARGE":
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5" y="9" width="22" height="7" rx="1" />
          <line x1="5" y1="9" x2="2" y2="6" />
          <line x1="27" y1="9" x2="30" y2="6" />
          {[4, 8, 12, 16, 20, 24, 28].map((x, i) => (
            <circle key={x} cx={x} cy={21 + (i % 2)} r="1.2" fill="currentColor" stroke="none" />
          ))}
        </svg>
      );
    case "ARENA":
    default:
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 22 C3 13, 29 13, 29 22" />
          <path d="M7 22 C7 16, 25 16, 25 22" />
          <rect x="12" y="17.5" width="8" height="4.5" rx="0.8" />
          {[2, 6, 26, 30].map((x) => (
            <circle key={x} cx={x} cy={23.5} r="1" fill="currentColor" stroke="none" />
          ))}
        </svg>
      );
  }
}
