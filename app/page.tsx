import { isDemoMode } from "@/lib/ai";
import { seedEvents } from "@/lib/events";
import { Dashboard } from "@/components/Dashboard";

// Seed events are generated per-request so each visit starts fresh.
export const dynamic = "force-dynamic";

/**
 * Dashboard entry point (server component).
 *
 * Generates a small batch of seed events on the server so the dashboard is
 * populated on first paint, then hands off to the client `Dashboard`, which
 * opens the live SSE stream. `isDemoMode` is resolved on the server and
 * passed down so the UI can surface the demo badge without exposing env.
 */
export default function Page() {
  const seed = seedEvents(20);
  return <Dashboard seed={seed} demoMode={isDemoMode} />;
}
