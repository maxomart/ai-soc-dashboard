"use client";

/**
 * Client hook that consumes the SSE security-event stream.
 *
 * Owns the rolling event buffer (newest first, capped to keep memory and
 * render cost bounded), exposes pause/resume/clear controls, and derives the
 * KPIs and chart aggregates the dashboard renders. EventSource is a
 * browser-only API, so this hook is `use client` and opens the connection
 * inside an effect that never runs during SSR.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EVENT_TYPE_LABELS } from "@/lib/events";
import type { EventType, SecurityEvent, Severity } from "@/lib/types";

/** Largest number of events kept in memory at once. */
const MAX_EVENTS = 250;
/** Window used to compute the "events / min" KPI. */
const RATE_WINDOW_MS = 60_000;

export interface SeverityDatum {
  severity: Severity;
  count: number;
}

export interface TypeDatum {
  type: EventType;
  label: string;
  count: number;
}

export interface StreamStats {
  /** Total events received this session. */
  total: number;
  /** Events seen in the last 60s. */
  perMinute: number;
  /** Count of open critical alerts in the current buffer. */
  openCritical: number;
  /** Mean risk score across the current buffer (0-100). */
  meanScore: number;
  /** Count per severity bucket for the distribution chart. */
  bySeverity: SeverityDatum[];
  /** Count per event type for the type chart. */
  byType: TypeDatum[];
}

export interface UseEventStream {
  events: SecurityEvent[];
  stats: StreamStats;
  paused: boolean;
  connected: boolean;
  pause: () => void;
  resume: () => void;
  clear: () => void;
}

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];

/**
 * @param seed Initial events rendered before the stream connects, so the
 *             dashboard is populated on first paint.
 */
export function useEventStream(seed: SecurityEvent[] = []): UseEventStream {
  const [events, setEvents] = useState<SecurityEvent[]>(() =>
    [...seed].sort((a, b) => b.ts - a.ts).slice(0, MAX_EVENTS),
  );
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);

  // `paused` is read inside the SSE handler; a ref avoids re-subscribing the
  // EventSource every time the user toggles pause.
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const source = new EventSource("/api/stream");

    source.onopen = () => setConnected(true);

    source.onmessage = (e: MessageEvent<string>) => {
      if (pausedRef.current) return;
      try {
        const event = JSON.parse(e.data) as SecurityEvent;
        setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
      } catch {
        // Ignore malformed frames (e.g. the initial comment ping).
      }
    };

    source.onerror = () => {
      // The browser auto-reconnects; reflect the transient drop in the UI.
      setConnected(false);
    };

    return () => source.close();
  }, []);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);
  const clear = useCallback(() => setEvents([]), []);

  const stats = useMemo<StreamStats>(() => {
    const now = Date.now();

    const bySeverityCount: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const byTypeCount = {} as Record<EventType, number>;
    let scoreSum = 0;
    let perMinute = 0;

    for (const event of events) {
      bySeverityCount[event.severity] += 1;
      byTypeCount[event.type] = (byTypeCount[event.type] ?? 0) + 1;
      scoreSum += event.score;
      if (now - event.ts <= RATE_WINDOW_MS) perMinute += 1;
    }

    const bySeverity: SeverityDatum[] = SEVERITIES.map((severity) => ({
      severity,
      count: bySeverityCount[severity],
    }));

    const byType: TypeDatum[] = (
      Object.entries(byTypeCount) as Array<[EventType, number]>
    )
      .map(([type, count]) => ({
        type,
        label: EVENT_TYPE_LABELS[type],
        count,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total: events.length,
      perMinute,
      openCritical: bySeverityCount.critical,
      meanScore: events.length ? Math.round(scoreSum / events.length) : 0,
      bySeverity,
      byType,
    };
  }, [events]);

  return { events, stats, paused, connected, pause, resume, clear };
}
