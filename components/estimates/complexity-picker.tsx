import { COMPLEXITY_LEVELS, type ComplexityLevel, type Department } from "@/lib/engine/types";
import { TierIcon, tierPhoto } from "./tier-icons";

const LABELS: Record<ComplexityLevel, string> = {
  NONE: "Not Needed",
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
  ARENA: "Arena",
};

// Marker classes on each radio input so the (server-rendered, JS-free) preview
// panel can target "which one is checked" via a `:has()` selector scoped to
// this picker instance — see the `group-has-[.is-<level>:checked]` usages below.
const LEVEL_MARKER: Record<ComplexityLevel, string> = {
  NONE: "is-none",
  SMALL: "is-small",
  MEDIUM: "is-medium",
  LARGE: "is-large",
  ARENA: "is-arena",
};

const PREVIEW_LEVELS = COMPLEXITY_LEVELS.filter((level) => level !== "NONE") as Exclude<ComplexityLevel, "NONE">[];

// Written out as literal strings (not built via template interpolation) so
// Tailwind's build-time class scanner — which matches complete class names
// verbatim in the source text — can actually see and generate them.
const PREVIEW_PANEL_VISIBLE_CLASS: Record<Exclude<ComplexityLevel, "NONE">, string> = {
  SMALL: "group-has-[.is-small:checked]:block",
  MEDIUM: "group-has-[.is-medium:checked]:block",
  LARGE: "group-has-[.is-large:checked]:block",
  ARENA: "group-has-[.is-arena:checked]:block",
};

const PREVIEW_LAYER_VISIBLE_CLASS: Record<Exclude<ComplexityLevel, "NONE">, string> = {
  SMALL: "group-has-[.is-small:checked]:flex",
  MEDIUM: "group-has-[.is-medium:checked]:flex",
  LARGE: "group-has-[.is-large:checked]:flex",
  ARENA: "group-has-[.is-arena:checked]:flex",
};

/**
 * Click-to-select scale picker (None/Small/Medium/Large/Arena) rendered as a
 * row of image cards, plus a large preview of whichever tier is currently
 * selected. Pure CSS (radio inputs + `peer-checked`/`:has()`) so it needs no
 * client-side JavaScript — works the same in a server-rendered form as a
 * native <select> would, and the preview only renders while the enclosing
 * <details> section is open since it's inert (not just hidden) when closed.
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
    <div className="group flex flex-wrap items-start gap-4">
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {COMPLEXITY_LEVELS.map((level) => {
          const photo = tierPhoto(department, level);
          return (
            <label key={level} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={level}
                defaultChecked={defaultValue === level}
                className={`peer sr-only ${LEVEL_MARKER[level]}`}
              />
              <div className="flex w-[72px] flex-col items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-2 text-center transition-colors peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="h-7 w-10 rounded-sm object-cover" />
                ) : (
                  <TierIcon level={level} className="h-7 w-7" />
                )}
                <span className="text-[11px] font-medium leading-tight">{LABELS[level]}</span>
              </div>
            </label>
          );
        })}
      </div>

      <div
        className={[
          "hidden h-28 w-40 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted shadow-sm",
          PREVIEW_PANEL_VISIBLE_CLASS.SMALL,
          PREVIEW_PANEL_VISIBLE_CLASS.MEDIUM,
          PREVIEW_PANEL_VISIBLE_CLASS.LARGE,
          PREVIEW_PANEL_VISIBLE_CLASS.ARENA,
        ].join(" ")}
      >
        {PREVIEW_LEVELS.map((level) => {
          const photo = tierPhoto(department, level);
          return (
            <div
              key={level}
              className={`hidden h-full w-full items-center justify-center p-3 text-accent ${PREVIEW_LAYER_VISIBLE_CLASS[level]}`}
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={`${LABELS[level]} reference`} className="h-full w-full rounded object-cover" />
              ) : (
                <TierIcon level={level} className="h-20 w-20" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
