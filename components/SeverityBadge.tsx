import type { Severity } from "@/lib/types";
import { SEVERITY_STYLES } from "@/lib/ui";

interface SeverityBadgeProps {
  severity: Severity;
  /** Optionally show the numeric risk score alongside the label. */
  score?: number;
  className?: string;
}

/** Compact, color-coded severity pill used in the feed, queue and drawer. */
export function SeverityBadge({ severity, score, className = "" }: SeverityBadgeProps) {
  const s = SEVERITY_STYLES[severity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.bg} ${s.border} ${s.text} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
      {typeof score === "number" && (
        <span className="font-mono text-[10px] opacity-70">{score}</span>
      )}
    </span>
  );
}
