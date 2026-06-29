"use client";

/**
 * Slide-in detail drawer for a selected alert. Shows the full event record
 * and runs AI triage on demand by POSTing the event to `/api/triage`. The
 * triage result (and any per-event cache) is keyed by event id so reopening
 * an already-analyzed alert shows its result instantly.
 */

import { useCallback, useEffect, useState } from "react";

import { EVENT_TYPE_LABELS } from "@/lib/events";
import type { SecurityEvent, TriageResult } from "@/lib/types";
import { formatTime } from "@/lib/ui";
import { SeverityBadge } from "./SeverityBadge";

interface AlertDrawerProps {
  event: SecurityEvent | null;
  onClose: () => void;
}

type TriageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: TriageResult }
  | { status: "error"; message: string };

export function AlertDrawer({ event, onClose }: AlertDrawerProps) {
  const [triage, setTriage] = useState<TriageState>({ status: "idle" });
  // Cache triage results across opens within the session, keyed by event id.
  const [cache, setCache] = useState<Record<string, TriageResult>>({});

  // When the selected event changes, restore its cached triage (or reset).
  useEffect(() => {
    if (!event) return;
    const cached = cache[event.id];
    setTriage(cached ? { status: "done", result: cached } : { status: "idle" });
  }, [event, cache]);

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  const runTriage = useCallback(async () => {
    if (!event) return;
    setTriage({ status: "loading" });
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event }),
      });
      if (!res.ok) throw new Error(`Triage request failed (${res.status})`);
      const result = (await res.json()) as TriageResult;
      setCache((prev) => ({ ...prev, [event.id]: result }));
      setTriage({ status: "done", result });
    } catch (err) {
      setTriage({
        status: "error",
        message: err instanceof Error ? err.message : "Unexpected error.",
      });
    }
  }, [event]);

  const open = event !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-panel-border bg-panel shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Alert details"
      >
        {event && (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-panel-border p-4">
              <div>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={event.severity} score={event.score} />
                  <span className="text-xs font-medium text-zinc-400">
                    {EVENT_TYPE_LABELS[event.type]}
                  </span>
                </div>
                <h2 className="mt-2 text-sm font-semibold leading-snug text-zinc-100">
                  {event.message}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="soc-scroll flex-1 overflow-y-auto p-4">
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-panel-border bg-panel-border text-xs">
                <Field label="Source IP" value={event.sourceIp} mono />
                <Field label="Target asset" value={event.asset} mono />
                <Field label="Detected" value={formatTime(event.ts)} mono />
                <Field label="Risk score" value={`${event.score} / 100`} mono />
              </dl>

              <Signals event={event} />

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
                    <SparkIcon /> AI triage
                  </h3>
                  {triage.status === "done" && (
                    <span className="rounded-md border border-panel-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                      {triage.result.source === "openai" ? "OpenAI" : "Demo"}
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  {triage.status === "idle" && (
                    <button
                      type="button"
                      onClick={runTriage}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                    >
                      <SparkIcon /> Run AI triage
                    </button>
                  )}

                  {triage.status === "loading" && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Spinner /> Analyzing incident…
                    </div>
                  )}

                  {triage.status === "error" && (
                    <div className="rounded-lg border border-severity-critical/40 bg-severity-critical/10 p-3 text-sm text-severity-critical">
                      <p>{triage.message}</p>
                      <button
                        type="button"
                        onClick={runTriage}
                        className="mt-2 text-xs font-medium underline underline-offset-2"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {triage.status === "done" && (
                    <TriageReport result={triage.result} />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/** A single read-only field cell inside the detail grid. */
function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-panel p-2.5">
      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 text-zinc-200 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

/** Render the contextual signals that drove the severity score, if any. */
function Signals({ event }: { event: SecurityEvent }) {
  const chips: string[] = [];
  const s = event.signals;
  if (s.attempts && s.attempts > 1) chips.push(`${s.attempts} attempts`);
  if (s.dataVolumeMb) chips.push(`${s.dataVolumeMb} MB moved`);
  if (s.knownBadIp) chips.push("Known-bad IP");
  if (s.criticalAsset) chips.push("Critical asset");
  if (s.offHours) chips.push("Off-hours");

  if (chips.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-[10px] uppercase tracking-wider text-zinc-500">
        Detection signals
      </h3>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-md border border-panel-border bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The completed triage summary + recommended actions. */
function TriageReport({ result }: { result: TriageResult }) {
  return (
    <div className="rounded-lg border border-panel-border bg-zinc-900/60 p-3">
      <p className="text-[13px] leading-relaxed text-zinc-300">{result.summary}</p>
      <h4 className="mt-3 text-[10px] uppercase tracking-wider text-zinc-500">
        Recommended actions
      </h4>
      <ol className="mt-1.5 space-y-1.5">
        {result.recommendedActions.map((action, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-zinc-300">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent/20 font-mono text-[10px] text-accent">
              {i + 1}
            </span>
            <span>{action}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* --- Icons --- */

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
