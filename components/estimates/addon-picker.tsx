import { AddOnIcon } from "./addon-icons";

export interface AddOnOption {
  id: string;
  name: string;
  sellRate: number;
}

/**
 * Click-to-toggle add-on cards (Podcast Recording, Graphics Support, ...).
 * Unlike the Small/Medium/Large/Arena scale picker, any number of these can
 * be selected at once, so each is its own checkbox rather than a shared
 * radio group. Pure CSS (peer-checked), no client JS needed.
 */
export function AddOnPicker({ options, selectedIds = [] }: { options: AddOnOption[]; selectedIds?: string[] }) {
  if (options.length === 0) return null;
  const selected = new Set(selectedIds);

  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => (
        <label key={option.id} className="cursor-pointer">
          <input type="checkbox" name={`addon_${option.id}`} defaultChecked={selected.has(option.id)} className="peer sr-only" />
          <div className="flex w-[140px] flex-col items-center gap-1.5 rounded-md border border-border bg-surface-muted px-3 py-3 text-center transition-colors peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40">
            <AddOnIcon name={option.name} className="h-8 w-8" />
            <span className="text-xs font-medium leading-tight">{option.name}</span>
            <span className="text-[11px] text-muted-foreground">${option.sellRate.toLocaleString()}</span>
          </div>
        </label>
      ))}
    </div>
  );
}
