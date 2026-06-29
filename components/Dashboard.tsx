"use client";

/**
 * Top-level client orchestrator for the SOC dashboard.
 *
 * Wires the SSE stream hook to every panel: KPI row, charts, live feed,
 * alert queue and the triage drawer. Owns the cross-cutting UI state —
 * selected alert and the "hover hold" that pauses the feed while the analyst
 * reads — and renders the header controls (pause/resume, clear).
 */

import { useCallback, useEffect, useState } from "react";

import type { SecurityEvent } from "@/lib/types";
import { AlertDrawer } from "./AlertDrawer";
import { AlertQueue } from "./AlertQueue";
import { SeverityChart, TypeChart } from "./Charts";
import { KpiRow } from "./KpiRow";
import { LiveFeed } from "./LiveFeed";
import { useEventStream } from "./useEventStream";

interface DashboardProps {
  /** Server-seeded events so the dashboard is populated on first paint. */
  seed: SecurityEvent[];
  /** Whether the AI triage runs against the mock engine (no key set). */
  demoMode: boolean;
}

export function Dashboard({ seed, demoMode }: DashboardProps) {
  const { events, stats, paused, connected, pause, resume, clear } =
    useEventStream(seed);

  const [selected, setSelected] = useState<SecurityEvent | null>(null);
  // True while the pointer hovers the feed; auto-pauses incoming updates.
  const [feedHold, setFeedHold] = useState(false);

  // Apply the hover-hold by pausing the stream, but never override an
  // explicit user pause when the pointer leaves.
  const [userPaused, setUserPaused] = useState(false);
  useEffect(() => {
    if (feedHold || userPaused) pause();
    else resume();
  }, [feedHold, userPaused, pause, resume]);

  const togglePause = useCallback(() => setUserPaused((p) => !p), []);
  const handleClear = useCallback(() => {
    clear();
    setSelected(null);
  }, [clear]);

  return (
    <div className="min-h-screen">
      <Header
        connected={connected}
        userPaused={userPaused}
        feedHold={feedHold}
        demoMode={demoMode}
        onTogglePause={togglePause}
        onClear={handleClear}
      />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <KpiRow stats={stats} />

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SeverityChart data={stats.bySeverity} />
          <TypeChart data={stats.byType} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          {/* Live feed — wider column */}
          <section className="rounded-xl border border-panel-border bg-panel/80 backdrop-blur lg:col-span-3">
            <PanelHeader
              title="Live event feed"
              subtitle={paused ? "Paused" : "Streaming"}
              live={!paused}
            />
            <LiveFeed
              events={events}
              selectedId={selected?.id}
              onSelect={setSelected}
              onHoldChange={setFeedHold}
            />
          </section>

          {/* Alert queue — narrower column */}
          <section className="rounded-xl border border-panel-border bg-panel/80 backdrop-blur lg:col-span-2">
            <PanelHeader
              title="Alert queue"
              subtitle={`${stats.bySeverity[0].count + stats.bySeverity[1].count} actionable`}
            />
            <AlertQueue
              events={events}
              selectedId={selected?.id}
              onSelect={setSelected}
            />
          </section>
        </div>
      </main>

      <AlertDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/* --- Header --- */

interface HeaderProps {
  connected: boolean;
  userPaused: boolean;
  feedHold: boolean;
  demoMode: boolean;
  onTogglePause: () => void;
  onClear: () => void;
}

function Header({
  connected,
  userPaused,
  feedHold,
  demoMode,
  onTogglePause,
  onClear,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-panel-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <div className="leading-tight">
            <h1 className="text-sm font-semibold text-zinc-100">AI SOC Dashboard</h1>
            <p className="text-[11px] text-zinc-500">Security Operations Center</p>
          </div>
        </div>

        <div className="ml-2 hidden items-center gap-1.5 sm:flex">
          <StatusDot connected={connected} />
          <span className="text-xs text-zinc-400">
            {connected ? "Stream connected" : "Reconnecting…"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {demoMode && (
            <span
              className="hidden rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-[11px] font-medium text-indigo-300 sm:inline-block"
              title="No OPENAI_API_KEY set — triage uses a built-in mock engine."
            >
              Demo mode
            </span>
          )}

          <button
            type="button"
            onClick={onTogglePause}
            className="inline-flex items-center gap-1.5 rounded-lg border border-panel-border bg-panel px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.04]"
            aria-pressed={userPaused}
          >
            {userPaused ? <PlayIcon /> : <PauseIcon />}
            {userPaused ? "Resume" : "Pause"}
          </button>

          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-panel-border bg-panel px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.04]"
          >
            <TrashIcon />
            Clear
          </button>
        </div>
      </div>

      {/* Subtle banner explaining the auto-pause-on-hover behavior. */}
      {feedHold && !userPaused && (
        <div className="border-t border-panel-border bg-accent/[0.06] px-4 py-1 text-center text-[11px] text-indigo-300 sm:px-6">
          Feed held while hovering — move the cursor away to resume.
        </div>
      )}
    </header>
  );
}

/** Reusable panel header with an optional live indicator. */
function PanelHeader({
  title,
  subtitle,
  live,
}: {
  title: string;
  subtitle: string;
  live?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-panel-border px-4 py-2.5">
      <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        {live && (
          <span className="soc-pulse h-1.5 w-1.5 rounded-full bg-severity-low" />
        )}
        {subtitle}
      </span>
    </div>
  );
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`h-2 w-2 rounded-full ${
        connected ? "bg-severity-low soc-pulse" : "bg-severity-medium"
      }`}
      aria-hidden
    />
  );
}

/* --- Icons --- */

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#6366f1" fillOpacity="0.12" />
      <path
        d="M16 5 7 8.5V15c0 5.2 3.8 9.1 9 11 5.2-1.9 9-5.8 9-11V8.5L16 5Z"
        stroke="#6366f1"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M11 16h2l1.5 4L17 11l1.5 5H21" stroke="#818cf8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 5v14l12-7L7 5Z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}
