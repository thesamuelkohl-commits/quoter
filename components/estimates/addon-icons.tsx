/**
 * Small pictographs for the Add-Ons picker. Matched to an add-on by keyword
 * in its name so new add-ons (added via seed/admin later) still get a
 * sensible icon without a manual mapping table.
 */
export function AddOnIcon({ name, className = "" }: { name: string; className?: string }) {
  const normalized = name.toLowerCase();

  if (normalized.includes("podcast")) {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="12" y="4" width="8" height="14" rx="4" />
        <path d="M8 15a8 8 0 0 0 16 0" />
        <line x1="16" y1="23" x2="16" y2="28" />
        <line x1="11" y1="28" x2="21" y2="28" />
      </svg>
    );
  }

  if (normalized.includes("graphic")) {
    return (
      <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="24" height="18" rx="1.5" />
        <path d="M8 17l5-6 4 4 6-7" />
        <circle cx="23" cy="8" r="1.2" fill="currentColor" stroke="none" />
        <line x1="10" y1="26" x2="22" y2="26" />
      </svg>
    );
  }

  // Generic add-on fallback: a plus-in-circle badge.
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="16" cy="16" r="11" />
      <line x1="16" y1="11" x2="16" y2="21" />
      <line x1="11" y1="16" x2="21" y2="16" />
    </svg>
  );
}
