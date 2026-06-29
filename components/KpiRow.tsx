import type { ReactNode } from "react";

import type { StreamStats } from "./useEventStream";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Tailwind text-color class for the value (defaults to foreground). */
  accent?: string;
  icon: ReactNode;
}

/** A single KPI tile. */
function KpiCard({ label, value, hint, accent, icon }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-panel-border bg-panel/80 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <span className="text-zinc-600">{icon}</span>
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${accent ?? "text-zinc-100"}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

/** Severity-colored hint label for the mean-score tile. */
function scoreHint(score: number): { text: string; accent: string } {
  if (score >= 80) return { text: "Critical posture", accent: "text-severity-critical" };
  if (score >= 60) return { text: "Elevated posture", accent: "text-severity-high" };
  if (score >= 35) return { text: "Guarded posture", accent: "text-severity-medium" };
  return { text: "Nominal posture", accent: "text-severity-low" };
}

/** Top KPI row: events/min, open critical, total events, mean severity. */
export function KpiRow({ stats }: { stats: StreamStats }) {
  const score = scoreHint(stats.meanScore);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Events / min"
        value={stats.perMinute}
        hint="Rolling 60s window"
        icon={<PulseIcon />}
      />
      <KpiCard
        label="Open critical"
        value={stats.openCritical}
        hint="Awaiting triage"
        accent="text-severity-critical"
        icon={<AlertIcon />}
      />
      <KpiCard
        label="Total events"
        value={stats.total.toLocaleString("en-US")}
        hint="This session"
        icon={<StackIcon />}
      />
      <KpiCard
        label="Mean severity"
        value={stats.meanScore}
        hint={score.text}
        accent={score.accent}
        icon={<GaugeIcon />}
      />
    </div>
  );
}

/* --- Inline icons (no dependency, inherit currentColor) --- */

function PulseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2 6 4-14 2 8h6" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}
function StackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
    </svg>
  );
}
function GaugeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 14 8 9" />
      <path d="M3.3 17a9 9 0 1 1 17.4 0" />
    </svg>
  );
}
