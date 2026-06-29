/**
 * AI triage endpoint.
 *
 * Accepts a single security event in the POST body and returns an incident
 * triage (summary + recommended actions). Delegates to `triageEvent`, which
 * uses OpenAI when a key is configured and a deterministic mock otherwise,
 * so this route is safe to call with no environment configuration.
 */

import { NextResponse } from "next/server";

import { triageEvent } from "@/lib/ai";
import type { SecurityEvent } from "@/lib/types";

// Triage may call out to OpenAI, so it needs the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Narrow an unknown payload to the fields triage actually relies on. */
function isSecurityEvent(value: unknown): value is SecurityEvent {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.type === "string" &&
    typeof e.message === "string" &&
    typeof e.asset === "string" &&
    typeof e.sourceIp === "string" &&
    typeof e.severity === "string"
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const event = (body as { event?: unknown })?.event ?? body;
  if (!isSecurityEvent(event)) {
    return NextResponse.json(
      { error: "Body must contain a security event." },
      { status: 422 },
    );
  }

  // triageEvent never throws — it falls back to the mock on any failure.
  const result = await triageEvent(event);
  return NextResponse.json(result);
}
