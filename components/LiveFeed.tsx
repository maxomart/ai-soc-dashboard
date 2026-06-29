"use client";

/**
 * Live event feed. Renders the rolling event buffer newest-first and pins
 * the scroll position to the top so fresh events animate in. Hovering the
 * feed sets a local "hold" flag the parent uses to pause incoming updates,
 * giving the analyst a chance to read without rows shifting underfoot.
 */

import { EVENT_TYPE_LABELS } from "@/lib/events";
import type { SecurityEvent } from "@/lib/types";
import { SEVERITY_STYLES, formatTime } from "@/lib/ui";

interface LiveFeedProps {
  events: SecurityEvent[];
  /** Currently selected alert id, highlighted in the list. */
  selectedId?: string;
  onSelect: (event: SecurityEvent) => void;
  /** Called when the pointer enters/leaves so the parent can hold the stream. */
  onHoldChange: (hold: boolean) => void;
}

export function LiveFeed({ events, selectedId, onSelect, onHoldChange }: LiveFeedProps) {
  return (
    <div
      className="soc-scroll max-h-[460px] overflow-y-auto"
      onMouseEnter={() => onHoldChange(true)}
      onMouseLeave={() => onHoldChange(false)}
    >
      {events.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-zinc-600">
          Feed cleared — new events will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-panel-border/60">
          {events.map((event) => {
            const s = SEVERITY_STYLES[event.severity];
            const selected = event.id === selectedId;
            return (
              <li key={event.id} className="soc-row-in">
                <button
                  type="button"
                  onClick={() => onSelect(event)}
                  className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.03] ${
                    selected ? "bg-accent/10" : ""
                  }`}
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.dot}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-zinc-500">
                        {formatTime(event.ts)}
                      </span>
                      <span className="truncate text-xs font-medium text-zinc-300">
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-[11px] text-zinc-600">
                        {event.sourceIp}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-zinc-400">
                      {event.message}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
