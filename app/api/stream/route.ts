/**
 * Server-Sent Events endpoint streaming simulated security events.
 *
 * Emits one freshly-generated, severity-classified event every ~1-2s as a
 * `text/event-stream`. The stream is fully cancellable: when the client
 * disconnects, the request's abort signal fires and the interval is torn
 * down so we never leak timers on the server.
 */

import { generateEvent } from "@/lib/events";

// SSE requires a long-lived Node runtime; the Edge runtime is not suitable.
export const runtime = "nodejs";
// Never cache a live stream.
export const dynamic = "force-dynamic";

/** Serialize a payload as a single SSE `data:` frame. */
function sseFrame(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function GET(request: Request): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      /** Push one event, then schedule the next at a randomized interval. */
      const tick = () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseFrame(generateEvent())));
        } catch {
          // Controller already closed (client vanished mid-enqueue).
          cleanup();
          return;
        }
        // Jittered cadence between 1.0s and 2.0s feels like a live feed.
        const delay = 1000 + Math.floor(Math.random() * 1000);
        timer = setTimeout(tick, delay);
      };

      /** Tear down the interval and close the stream exactly once. */
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        request.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          // Already closed — nothing to do.
        }
      };

      // Stop streaming the moment the client disconnects.
      if (request.signal.aborted) {
        cleanup();
        return;
      }
      request.signal.addEventListener("abort", cleanup);

      // Prime the feed immediately, then settle into the jittered cadence.
      controller.enqueue(encoder.encode(": connected\n\n"));
      tick();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (e.g. nginx) so frames flush promptly.
      "X-Accel-Buffering": "no",
    },
  });
}
