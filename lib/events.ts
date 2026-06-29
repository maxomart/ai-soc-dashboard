/**
 * Server-side security event simulator.
 *
 * Generates realistic, varied security events with plausible source IPs,
 * targeted assets and contextual signals. Each generated event is passed
 * through the severity engine so it arrives at the client fully enriched.
 *
 * This module is intentionally pure (no I/O, no timers) so it can be unit
 * tested and reused by both the SSE route and any seeding logic.
 */

import { classify } from "./severity";
import type {
  EventSignals,
  EventType,
  SecurityEvent,
} from "./types";

/** Catalogue of event types with relative spawn weights. */
const TYPE_WEIGHTS: Array<{ type: EventType; weight: number }> = [
  { type: "failed_login", weight: 26 },
  { type: "policy_violation", weight: 16 },
  { type: "port_scan", weight: 14 },
  { type: "brute_force", weight: 12 },
  { type: "ddos_spike", weight: 8 },
  { type: "privilege_escalation", weight: 8 },
  { type: "malware_detected", weight: 9 },
  { type: "data_exfiltration", weight: 7 },
];

const TYPE_WEIGHT_TOTAL = TYPE_WEIGHTS.reduce((sum, t) => sum + t.weight, 0);

/** Pool of business-critical assets (weighted higher in some events). */
const CRITICAL_ASSETS = [
  "prod-db-01.internal",
  "vault.corp.internal",
  "k8s-api-prod",
  "payments-svc",
  "domain-controller-01",
];

/** Pool of standard assets. */
const STANDARD_ASSETS = [
  "web-frontend-03",
  "jenkins-ci",
  "fileshare-eu",
  "vpn-gateway-2",
  "workstation-amelia",
  "workstation-raj",
  "mail-relay-01",
  "grafana-internal",
  "staging-api",
  "backup-nas-04",
];

/** Realistic-looking user accounts for auth-related events. */
const USER_ACCOUNTS = [
  "svc-deploy",
  "admin",
  "j.collins",
  "r.okafor",
  "m.tanaka",
  "root",
  "backup-agent",
];

/** Pick a uniformly random element from a non-empty array. */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Random integer in the inclusive [min, max] range. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Generate a RFC-4122-ish identifier without pulling in a dependency. */
function makeId(): string {
  // crypto.randomUUID is available in Node 18 and modern browsers.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * Generate a plausible public-looking IPv4 address. Avoids reserved
 * ranges (0.x, 10.x, 127.x, 192.168.x) so addresses read as external.
 */
function randomExternalIp(): string {
  const firstOctet = pick([23, 45, 77, 91, 103, 141, 185, 196, 203, 209]);
  return `${firstOctet}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
}

/** Generate an internal RFC-1918 address for lateral-movement scenarios. */
function randomInternalIp(): string {
  return `10.${randInt(0, 40)}.${randInt(0, 255)}.${randInt(1, 254)}`;
}

/** Choose the weighted random event type. */
function pickType(): EventType {
  let roll = Math.random() * TYPE_WEIGHT_TOTAL;
  for (const { type, weight } of TYPE_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return TYPE_WEIGHTS[0].type;
}

/** Decide whether the current event should target a critical asset. */
function pickAsset(biasCritical: boolean): { asset: string; critical: boolean } {
  const useCritical = biasCritical
    ? Math.random() < 0.6
    : Math.random() < 0.2;
  if (useCritical) return { asset: pick(CRITICAL_ASSETS), critical: true };
  return { asset: pick(STANDARD_ASSETS), critical: false };
}

/** Whether the simulated clock falls outside 08:00-19:00 local time. */
function isOffHours(): boolean {
  const hour = new Date().getHours();
  return hour < 8 || hour >= 19;
}

/**
 * Builders that produce the type-specific message, signals and source IP.
 * Each returns the variable parts of an event so the common envelope can
 * be assembled in {@link generateEvent}.
 */
const BUILDERS: Record<
  EventType,
  () => { message: string; signals: EventSignals; sourceIp: string; asset: string }
> = {
  failed_login: () => {
    const account = pick(USER_ACCOUNTS);
    const { asset } = pickAsset(false);
    const attempts = randInt(1, 4);
    return {
      sourceIp: randomExternalIp(),
      asset,
      message: `Failed SSH authentication for "${account}" on ${asset} (${attempts} attempt${attempts > 1 ? "s" : ""})`,
      signals: { attempts, offHours: isOffHours() },
    };
  },

  brute_force: () => {
    const account = pick(USER_ACCOUNTS);
    const { asset, critical } = pickAsset(true);
    const attempts = randInt(40, 480);
    return {
      sourceIp: randomExternalIp(),
      asset,
      message: `Brute-force credential attack against "${account}" on ${asset} — ${attempts} attempts in 60s`,
      signals: {
        attempts,
        knownBadIp: Math.random() < 0.5,
        criticalAsset: critical,
        offHours: isOffHours(),
      },
    };
  },

  port_scan: () => {
    const { asset } = pickAsset(false);
    const ports = randInt(120, 4096);
    return {
      sourceIp: randomExternalIp(),
      asset,
      message: `Horizontal port scan detected against ${asset} — ${ports} ports probed`,
      signals: {
        attempts: ports,
        knownBadIp: Math.random() < 0.35,
        offHours: isOffHours(),
      },
    };
  },

  malware_detected: () => {
    const { asset, critical } = pickAsset(true);
    const family = pick([
      "Emotet",
      "Cobalt Strike beacon",
      "AgentTesla",
      "Mimikatz",
      "XMRig miner",
    ]);
    return {
      sourceIp: randomInternalIp(),
      asset,
      message: `EDR quarantined ${family} on ${asset}`,
      signals: {
        knownBadIp: Math.random() < 0.6,
        criticalAsset: critical,
        offHours: isOffHours(),
      },
    };
  },

  data_exfiltration: () => {
    const { asset, critical } = pickAsset(true);
    const dataVolumeMb = randInt(80, 3200);
    return {
      sourceIp: randomExternalIp(),
      asset,
      message: `Anomalous outbound transfer from ${asset} — ${dataVolumeMb} MB to an unrecognized endpoint`,
      signals: {
        dataVolumeMb,
        knownBadIp: Math.random() < 0.55,
        criticalAsset: critical,
        offHours: isOffHours(),
      },
    };
  },

  privilege_escalation: () => {
    const account = pick(USER_ACCOUNTS);
    const { asset, critical } = pickAsset(true);
    return {
      sourceIp: randomInternalIp(),
      asset,
      message: `Unexpected privilege escalation: "${account}" gained root on ${asset}`,
      signals: {
        criticalAsset: critical,
        offHours: isOffHours(),
      },
    };
  },

  ddos_spike: () => {
    const { asset } = pickAsset(false);
    const rps = randInt(20_000, 480_000);
    return {
      sourceIp: randomExternalIp(),
      asset,
      message: `Volumetric DDoS spike on ${asset} — ${rps.toLocaleString("en-US")} req/s from distributed sources`,
      signals: {
        attempts: Math.round(rps / 1000),
        offHours: isOffHours(),
      },
    };
  },

  policy_violation: () => {
    const account = pick(USER_ACCOUNTS);
    const { asset } = pickAsset(false);
    const policy = pick([
      "data classification",
      "acceptable use",
      "encryption-at-rest",
      "MFA enrollment",
    ]);
    return {
      sourceIp: randomInternalIp(),
      asset,
      message: `Policy violation (${policy}) by "${account}" on ${asset}`,
      signals: { offHours: isOffHours() },
    };
  },
};

/**
 * Generate a single fully-enriched security event. An optional `type` can
 * be forced (used by seeding) — otherwise a weighted-random type is drawn.
 */
export function generateEvent(type: EventType = pickType()): SecurityEvent {
  const parts = BUILDERS[type]();
  const { score, severity } = classify(type, parts.signals);

  return {
    id: makeId(),
    ts: Date.now(),
    type,
    sourceIp: parts.sourceIp,
    asset: parts.asset,
    message: parts.message,
    severity,
    score,
    signals: parts.signals,
  };
}

/**
 * Produce a small batch of seed events so the dashboard is never empty on
 * first paint. Spreads timestamps across the recent past for realism.
 */
export function seedEvents(count = 18): SecurityEvent[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const event = generateEvent();
    // Backdate evenly over the last ~3 minutes, newest last.
    event.ts = now - (count - i) * randInt(3_000, 11_000);
    return event;
  }).sort((a, b) => a.ts - b.ts);
}

/** Human-friendly labels for each event type, used in the UI. */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  failed_login: "Failed Login",
  brute_force: "Brute Force",
  port_scan: "Port Scan",
  malware_detected: "Malware",
  data_exfiltration: "Data Exfiltration",
  privilege_escalation: "Privilege Escalation",
  ddos_spike: "DDoS Spike",
  policy_violation: "Policy Violation",
};
