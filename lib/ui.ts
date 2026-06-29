/**
 * Shared presentational constants and small formatting helpers used by the
 * dashboard components. Keeping these in one place ensures the severity
 * palette stays consistent across badges, the feed, charts and the drawer.
 */

import type { Severity } from "./types";

/** Tailwind class fragments for each severity, grouped by usage context. */
export const SEVERITY_STYLES: Record<
  Severity,
  {
    /** Text color utility. */
    text: string;
    /** Subtle translucent background (chips, rows). */
    bg: string;
    /** Border color utility. */
    border: string;
    /** Solid dot / indicator background. */
    dot: string;
    /** Raw hex, for non-Tailwind consumers such as Recharts. */
    hex: string;
    /** Capitalized human label. */
    label: string;
  }
> = {
  critical: {
    text: "text-severity-critical",
    bg: "bg-severity-critical/10",
    border: "border-severity-critical/40",
    dot: "bg-severity-critical",
    hex: "#ef4444",
    label: "Critical",
  },
  high: {
    text: "text-severity-high",
    bg: "bg-severity-high/10",
    border: "border-severity-high/40",
    dot: "bg-severity-high",
    hex: "#f97316",
    label: "High",
  },
  medium: {
    text: "text-severity-medium",
    bg: "bg-severity-medium/10",
    border: "border-severity-medium/40",
    dot: "bg-severity-medium",
    hex: "#f59e0b",
    label: "Medium",
  },
  low: {
    text: "text-severity-low",
    bg: "bg-severity-low/10",
    border: "border-severity-low/40",
    dot: "bg-severity-low",
    hex: "#10b981",
    label: "Low",
  },
};

/** Ordered severities, most urgent first — handy for legends and loops. */
export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

/** Format an epoch-ms timestamp as a 24h HH:MM:SS clock string. */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Compact "Xs ago" / "Xm ago" relative label for the alert queue. */
export function formatRelative(ts: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
