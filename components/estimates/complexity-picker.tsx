import { COMPLEXITY_LEVELS, type ComplexityLevel, type Department } from "@/lib/engine/types";
import { TierIcon, tierPhoto } from "./tier-icons";

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
 *
 * Tiers with a real reference photo (see tier-icons.tsx) get a small orange
 * button under their tile; clicking it opens that photo fullscreen via a
 * pure-CSS `:target` lightbox — independent of the radio selection itself,
 * so viewing the photo doesn't change what's picked.
 */
export function ComplexityPicker({
  name,
  defaultValue = "NONE",
  department,
}: {
  name: string;
  defaultValue?: ComplexityLevel;
  department?: Department;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {COMPLEXITY_LEVELS.map((level) => {
        const photo = tierPhoto(department, level);
        const anchorId = `${name}-photo-${level}`;
        const lightboxId = `${name}-lightbox-${level}`;
        return (
          <div key={level} className="flex flex-col items-center gap-1">
            <label className="cursor-pointer">
              <input type="radio" name={name} value={level} defaultChecked={defaultValue === level} className="peer sr-only" />
              <div className="flex w-[72px] flex-col items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-2 text-center transition-colors peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
                <TierIcon level={level} className="h-7 w-7" />
                <span className="text-[11px] font-medium leading-tight">{LABELS[level]}</span>
              </div>
            </label>
            {photo && (
              <a
                id={anchorId}
                href={`#${lightboxId}`}
                aria-label={`View ${LABELS[level]} reference photo`}
                className="h-2.5 w-[72px] rounded-sm bg-accent transition-opacity hover:opacity-80"
              />
            )}
            {photo && (
              <div id={lightboxId} className="fixed inset-0 z-50 hidden items-center justify-center bg-black/85 p-6 [&:target]:flex">
                <a href={`#${anchorId}`} className="absolute inset-0" aria-label="Close" />
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`${LABELS[level]} reference`} className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
                  <a
                    href={`#${anchorId}`}
                    aria-label="Close"
                    className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-medium leading-none text-black shadow"
                  >
                    &times;
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
