import type { HTMLAttributes } from "react";

const TONES = {
  neutral: "bg-surface-muted text-foreground border-border",
  accent: "bg-accent-soft text-accent border-accent/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-danger/10 text-danger border-danger/20",
} as const;

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
      {...props}
    />
  );
}

export function confidenceTone(level: "HIGH" | "MEDIUM" | "LOW"): keyof typeof TONES {
  if (level === "HIGH") return "success";
  if (level === "MEDIUM") return "warning";
  return "danger";
}
