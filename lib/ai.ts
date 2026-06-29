/**
 * AI triage layer with first-class demo mode.
 *
 * When `OPENAI_API_KEY` is absent the module returns realistic, hand-crafted
 * triage tailored to each event type — so the dashboard is fully functional
 * with zero configuration. When a key is present it calls the OpenAI Chat
 * Completions API via the official SDK and falls back to the mock on any
 * error, guaranteeing the endpoint never throws at runtime or build time.
 */

import { EVENT_TYPE_LABELS } from "./events";
import type { EventType, SecurityEvent, TriageResult } from "./types";

/**
 * True when no OpenAI key is configured. Exported so the UI can surface a
 * "Demo mode" badge and so server code can branch without re-reading env.
 */
export const isDemoMode = !process.env.OPENAI_API_KEY;

/** Model id, overridable via env; defaults to a fast, inexpensive model. */
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

/**
 * Per-type mock triage templates. Each produces a grounded summary and a
 * prioritized set of response actions that read like real analyst output.
 */
const MOCK_TRIAGE: Record<
  EventType,
  (event: SecurityEvent) => { summary: string; recommendedActions: string[] }
> = {
  brute_force: (e) => ({
    summary: `A high-velocity brute-force campaign targeted ${e.asset} from ${e.sourceIp}, registering ${e.signals.attempts ?? "many"} authentication attempts within a short window. The cadence is consistent with an automated credential-stuffing tool rather than human error. ${e.signals.criticalAsset ? "Because the target is a business-critical asset, a successful compromise would have outsized blast radius." : ""}`,
    recommendedActions: [
      `Temporarily block ${e.sourceIp} at the perimeter firewall and enable rate limiting on the affected service.`,
      `Force a password reset and revoke active sessions for any targeted account on ${e.asset}.`,
      "Confirm MFA is enforced for the service and review authentication logs for a successful login from the same source.",
      "Add the source IP to the threat-intel watchlist and monitor for pivoting to adjacent hosts.",
    ],
  }),

  data_exfiltration: (e) => ({
    summary: `An anomalous outbound transfer of ~${e.signals.dataVolumeMb ?? "unknown"} MB left ${e.asset} toward an unrecognized external endpoint via ${e.sourceIp}. The volume and destination deviate sharply from this asset's baseline egress, which is a strong indicator of data theft or staged exfiltration following an earlier compromise.`,
    recommendedActions: [
      `Isolate ${e.asset} from the network to halt any in-flight transfer.`,
      "Capture volatile memory and a disk image before remediation to preserve forensic evidence.",
      "Identify the destination endpoint, block it egress-wide, and determine what data classification was moved.",
      "Engage incident response and assess regulatory notification obligations if regulated data is involved.",
    ],
  }),

  malware_detected: (e) => ({
    summary: `Endpoint detection quarantined malicious code on ${e.asset}. ${e.message.replace(/^EDR quarantined /, "The detected payload was identified as ")}. While the file was contained, the presence of a live sample indicates the host was at least partially compromised and may host additional persistence mechanisms.`,
    recommendedActions: [
      `Fully isolate ${e.asset} and verify the EDR quarantine actually neutralized the sample.`,
      "Hunt for persistence: scheduled tasks, run keys, new services and unsigned drivers on the host.",
      "Pull the hash and IOCs, sweep the fleet for the same indicators, and block them in EDR.",
      "Reimage the host from a known-good baseline rather than cleaning in place.",
    ],
  }),

  privilege_escalation: (e) => ({
    summary: `An unexpected privilege escalation was observed on ${e.asset}, where an account obtained root-level access outside of any approved change. Unsanctioned escalation is a classic post-exploitation step used to establish durable control of a host and move laterally toward higher-value systems.`,
    recommendedActions: [
      `Review the audit trail on ${e.asset} to determine how the escalation was achieved (sudo misconfig, kernel exploit, stolen token).`,
      "Revoke the elevated session and rotate credentials and keys associated with the account.",
      "Check for newly created privileged accounts or modified sudoers entries.",
      "Correlate with authentication and EDR telemetry to reconstruct the intrusion timeline.",
    ],
  }),

  ddos_spike: (e) => ({
    summary: `${e.asset} is absorbing a volumetric denial-of-service spike sourced from a distributed set of addresses. The request rate far exceeds normal peak traffic, threatening availability. The distributed nature suggests a botnet or a reflection/amplification technique rather than a single noisy client.`,
    recommendedActions: [
      "Engage upstream DDoS mitigation / scrubbing and enable rate limiting at the edge.",
      `Scale out or shed load on ${e.asset} and serve a static fallback if the service degrades.`,
      "Identify the attack vector (SYN flood, HTTP flood, amplification) to apply the correct filter.",
      "Monitor for a low-and-slow secondary attack that may be masked by the volumetric noise.",
    ],
  }),

  port_scan: (e) => ({
    summary: `A horizontal port scan from ${e.sourceIp} enumerated services on ${e.asset}. Scanning is reconnaissance: on its own it is low impact, but it frequently precedes a targeted exploitation attempt against any exposed service that is discovered.`,
    recommendedActions: [
      `Review which ports on ${e.asset} are genuinely exposed and close anything unnecessary.`,
      `Block or rate-limit ${e.sourceIp} and watch for follow-on exploitation traffic.`,
      "Verify exposed services are patched and not running default or weak credentials.",
      "Confirm IDS signatures are tuned to catch the likely next-stage exploit.",
    ],
  }),

  failed_login: (e) => ({
    summary: `A small number of failed authentication attempts were recorded on ${e.asset} from ${e.sourceIp}. In isolation this is routine background noise — typos, stale credentials or expired sessions — but it is worth correlating in case it is the leading edge of a larger campaign.`,
    recommendedActions: [
      "Confirm the volume stays within normal baseline and is not accelerating.",
      `Verify the account exists and check whether the same source touches other assets.`,
      "Ensure account-lockout and MFA policies are in effect for the targeted service.",
    ],
  }),

  policy_violation: (e) => ({
    summary: `A security policy violation was logged on ${e.asset}. ${e.message}. Policy breaches are typically lower urgency than active attacks but can indicate misconfiguration, insider risk or a control gap that weakens the overall security posture.`,
    recommendedActions: [
      "Notify the asset or account owner and document the violation.",
      "Determine whether the breach was accidental or deliberate and remediate the underlying control.",
      "Verify the relevant policy is technically enforced rather than advisory where feasible.",
    ],
  }),
};

/** Build the deterministic mock triage for an event. */
function mockTriage(event: SecurityEvent): TriageResult {
  const { summary, recommendedActions } = MOCK_TRIAGE[event.type](event);
  return {
    eventId: event.id,
    summary: summary.replace(/\s+/g, " ").trim(),
    recommendedActions,
    source: "mock",
  };
}

/** Compose the system + user prompt sent to the model. */
function buildPrompt(event: SecurityEvent): { system: string; user: string } {
  const system =
    "You are a senior SOC analyst. Given a single security event, produce a concise " +
    "incident triage: a short factual summary of what most likely happened and a " +
    "prioritized list of concrete response actions. Respond ONLY with strict JSON of " +
    'the shape {"summary": string, "recommendedActions": string[]}. Keep the summary ' +
    "under 90 words and provide 3-5 actions.";

  const user = JSON.stringify(
    {
      type: EVENT_TYPE_LABELS[event.type],
      severity: event.severity,
      riskScore: event.score,
      sourceIp: event.sourceIp,
      asset: event.asset,
      message: event.message,
      signals: event.signals,
    },
    null,
    2,
  );

  return { system, user };
}

/**
 * Run AI triage for an event. Uses the live model when a key is present and
 * transparently falls back to the mock engine on any failure. Never throws.
 */
export async function triageEvent(event: SecurityEvent): Promise<TriageResult> {
  if (isDemoMode) {
    return mockTriage(event);
  }

  try {
    // Imported lazily so the package is only loaded when a key is configured,
    // keeping the demo-mode build free of the dependency at runtime.
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { system, user } = buildPrompt(event);
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return mockTriage(event);

    const parsed = JSON.parse(raw) as {
      summary?: unknown;
      recommendedActions?: unknown;
    };

    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : null;
    const recommendedActions = Array.isArray(parsed.recommendedActions)
      ? parsed.recommendedActions
          .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
          .map((a) => a.trim())
      : [];

    // If the model returned an unusable shape, fall back rather than ship junk.
    if (!summary || recommendedActions.length === 0) {
      return mockTriage(event);
    }

    return {
      eventId: event.id,
      summary,
      recommendedActions,
      source: "openai",
    };
  } catch {
    // Network error, quota exhaustion, malformed JSON, ... — degrade gracefully.
    return mockTriage(event);
  }
}
