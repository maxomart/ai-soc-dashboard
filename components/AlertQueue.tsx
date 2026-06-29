"use client";

/**
 * Prioritized alert queue. Filters the buffer down to actionable alerts
 * (critical + high), orders them by severity rank then recency, and lets the
 * analyst select one to open the triage drawer.
 */

import { useEffect, useMemo, useState } from "react";

import { SEVERITY_RANK } from "@/lib/severity";
import { EVENT_TYPE_LABELS } from "@/lib/events";
import type { SecurityEvent } from "@/lib/types";
import { SEVERITY_STYLES, formatRelative } from "@/lib/ui";
import { SeverityBadge } from "./SeverityBadge";

interface AlertQueueProps {
  events: SecurityEvent[];
  selectedId?: string;
  onSelect: (event: SecurityEvent) => void;
}

export function AlertQueue({ events, selectedId, onSelect }: AlertQueueProps) {
  // A 1s ticking clock keeps the relative "Xs ago" labels fresh without
  // re-deriving the queue on every streamed event.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const alerts = useMemo(
    () =>
      events
        .filter((e) => e.severity === "critical" || e.severity === "high")
        .sort(
          (a, b) =>
            SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.ts - a.ts,
        )
        .slice(0, 40),
    [events],
  );

  return (
    <div className="soc-scroll max-h-[460px] overflow-y-auto p-2">
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <ShieldCheck />
          <p className="mt-2 text-sm text-zinc-400">Queue is clear</p>
          <p className="text-xs text-zinc-600">
            No critical or high-severity alerts right now.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => {
            const s = SEVERITY_STYLES[alert.severity];
            const selected = alert.id === selectedId;
            return (
              <li key={alert.id}>
                <button
                  type="button"
                  onClick={() => onSelect(alert)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? "border-accent/60 bg-accent/10"
                      : `${s.border} bg-panel hover:bg-white/[0.03]`
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={alert.severity} score={alert.score} />
                    <span className="ml-auto font-mono text-[11px] text-zinc-500">
                      {formatRelative(alert.ts, now)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-zinc-200">
                    {EVENT_TYPE_LABELS[alert.type]}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-zinc-400">
                    {alert.message}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-zinc-600">
                    <span>{alert.sourceIp}</span>
                    <span aria-hidden>→</span>
                    <span className="truncate text-zinc-500">{alert.asset}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ShieldCheck() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-severity-low/70"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
