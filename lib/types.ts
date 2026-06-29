/**
 * Shared domain types for the SOC dashboard.
 *
 * These types are used across the server-side simulator, the severity
 * engine, the SSE stream and every client component, so they live in a
 * single dependency-free module that is safe to import anywhere.
 */

/** The catalogue of security event categories the simulator can emit. */
export type EventType =
  | "failed_login"
  | "brute_force"
  | "port_scan"
  | "malware_detected"
  | "data_exfiltration"
  | "privilege_escalation"
  | "ddos_spike"
  | "policy_violation";

/** Severity buckets, ordered from most to least urgent. */
export type Severity = "critical" | "high" | "medium" | "low";

/**
 * A single normalized security event as produced by the simulator and
 * enriched by the severity engine. Optional `signals` carry the raw
 * indicators that drove the classification (e.g. number of attempts).
 */
export interface SecurityEvent {
  /** Stable unique identifier (UUID-like). */
  id: string;
  /** Unix epoch milliseconds the event was generated. */
  ts: number;
  /** Event category. */
  type: EventType;
  /** Source IPv4 address that triggered the event. */
  sourceIp: string;
  /** Targeted asset (hostname, service or user account). */
  asset: string;
  /** Human-readable one-line description. */
  message: string;
  /** Computed severity bucket. */
  severity: Severity;
  /** Numeric risk score in the 0-100 range. */
  score: number;
  /** Raw indicators that influenced the score. */
  signals: EventSignals;
}

/** Indicators attached to an event and consumed by the severity engine. */
export interface EventSignals {
  /** Number of related attempts observed (logins, probes, ...). */
  attempts?: number;
  /** Whether the source IP is on a known threat-intel block list. */
  knownBadIp?: boolean;
  /** Whether the targeted asset is business-critical. */
  criticalAsset?: boolean;
  /** Approximate volume of data moved, in megabytes. */
  dataVolumeMb?: number;
  /** Whether the activity occurred outside business hours. */
  offHours?: boolean;
}

/** Result returned by the AI triage endpoint. */
export interface TriageResult {
  /** The id of the event that was triaged. */
  eventId: string;
  /** Narrative summary of what most likely happened. */
  summary: string;
  /** Ordered list of recommended response actions. */
  recommendedActions: string[];
  /** Whether the analysis came from the live model or the mock engine. */
  source: "openai" | "mock";
}
