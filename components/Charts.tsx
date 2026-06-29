"use client";

/**
 * Recharts-based visualizations. Recharts touches the DOM, so this whole
 * module is a client component. Both charts read their data from the derived
 * stream stats and recolor bars/slices by severity.
 */

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SEVERITY_STYLES } from "@/lib/ui";
import type { SeverityDatum, TypeDatum } from "./useEventStream";

/** Shared card chrome for both charts. */
function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-panel-border bg-panel/80 p-4 backdrop-blur">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
      <div className="h-44">{children}</div>
    </div>
  );
}

/** Minimal dark tooltip matching the dashboard palette. */
function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; payload?: { label?: string } }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  const name = point.payload?.label ?? label ?? point.name;
  return (
    <div className="rounded-lg border border-panel-border bg-zinc-900/95 px-2.5 py-1.5 text-xs shadow-xl">
      <span className="text-zinc-400">{name}: </span>
      <span className="font-mono font-semibold text-zinc-100">{point.value}</span>
    </div>
  );
}

/** Doughnut of events grouped by severity. */
export function SeverityChart({ data }: { data: SeverityDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const slices = data.filter((d) => d.count > 0);

  return (
    <ChartCard title="Severity distribution" subtitle="Live buffer breakdown">
      {total === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex h-full items-center gap-4">
          <div className="relative h-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="count"
                  nameKey="severity"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {slices.map((d) => (
                    <Cell key={d.severity} fill={SEVERITY_STYLES[d.severity].hex} />
                  ))}
                </Pie>
                <Tooltip content={<DarkTooltip />} cursor={false} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold text-zinc-100">{total}</span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                events
              </span>
            </div>
          </div>
          <ul className="flex flex-col gap-1.5">
            {data.map((d) => (
              <li key={d.severity} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: SEVERITY_STYLES[d.severity].hex }}
                />
                <span className="text-zinc-400">{SEVERITY_STYLES[d.severity].label}</span>
                <span className="ml-auto font-mono text-zinc-300">{d.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

/** Horizontal bars of events grouped by type, descending. */
export function TypeChart({ data }: { data: TypeDatum[] }) {
  return (
    <ChartCard title="Events by type" subtitle="Most frequent categories">
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
            barCategoryGap={6}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(99,102,241,0.08)" }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#6366f1" maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/** Placeholder shown until the stream delivers data. */
function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-xs text-zinc-600">
      Waiting for events…
    </div>
  );
}
