import { COMPLEXITY_LEVELS, type ComplexityLevel } from "@/lib/engine/types";
import { TierIcon } from "./tier-icons";

const LABELS: Record<ComplexityLevel, string> = {
  NONE: "Not Needed",
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
  ARENA: "Arena",
};

/**
 * Click-to-select scale picker (None/Small/Medium/Large/Arena) rendered as a
 * row of image cards. Pure CSS (radio inputs + `peer-checked`) so it needs no
 * client-side JavaScript — works the same in a server-rendered form as a
 * native <select> would.
 */
export function ComplexityPicker({ name, defaultValue = "NONE" }: { name: string; defaultValue?: ComplexityLevel }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {COMPLEXITY_LEVELS.map((level) => (
        <label key={level} className="cursor-pointer">
          <input type="radio" name={name} value={level} defaultChecked={defaultValue === level} className="peer sr-only" />
          <div className="flex w-[72px] flex-col items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-2 text-center transition-colors peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
            <TierIcon level={level} className="h-7 w-7" />
            <span className="text-[11px] font-medium leading-tight">{LABELS[level]}</span>
          </div>
        </label>
      ))}
    </div>
  );
}
