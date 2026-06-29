/**
 * Rule-based severity engine.
 *
 * Turns an event type plus its raw signals into a numeric risk score
 * (0-100) and a severity bucket. The logic is deliberately transparent
 * and deterministic: every contribution is additive so the resulting
 * score can be explained to an analyst, which mirrors how real
 * detection rules are tuned.
 */

import type { EventSignals, EventType, Severity } from "./types";

/**
 * Baseline risk contributed purely by the event category, before any
 * contextual signals are taken into account.
 */
const BASE_SCORE: Record<EventType, number> = {
  failed_login: 12,
  policy_violation: 20,
  port_scan: 32,
  brute_force: 48,
  ddos_spike: 58,
  privilege_escalation: 70,
  malware_detected: 74,
  data_exfiltration: 82,
};

/** Clamp a number into the inclusive [min, max] range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute a 0-100 risk score from an event type and its signals.
 * Contributions are additive and then clamped so the score stays within
 * range regardless of how many signals fire at once.
 */
export function scoreEvent(type: EventType, signals: EventSignals): number {
  let score = BASE_SCORE[type];

  // Repeated activity escalates risk; the curve flattens so a handful of
  // attempts matters a lot while hundreds of them does not keep stacking.
  if (signals.attempts && signals.attempts > 1) {
    score += clamp(Math.log2(signals.attempts) * 6, 0, 22);
  }

  // Threat-intel hit on the source address is a strong amplifier.
  if (signals.knownBadIp) score += 14;

  // Anything touching a crown-jewel asset is more dangerous.
  if (signals.criticalAsset) score += 12;

  // Large data movement is the defining signal of exfiltration.
  if (signals.dataVolumeMb && signals.dataVolumeMb > 50) {
    score += clamp(signals.dataVolumeMb / 40, 0, 18);
  }

  // Off-hours activity is statistically more likely to be malicious.
  if (signals.offHours) score += 6;

  return Math.round(clamp(score, 0, 100));
}

/** Map a numeric score onto a severity bucket using fixed thresholds. */
export function severityFromScore(score: number): Severity {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

/**
 * Convenience helper that classifies an event in one call, returning both
 * the score and the derived bucket.
 */
export function classify(
  type: EventType,
  signals: EventSignals,
): { score: number; severity: Severity } {
  const score = scoreEvent(type, signals);
  return { score, severity: severityFromScore(score) };
}

/** Numeric rank used to sort the alert queue (higher = more urgent). */
export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};
