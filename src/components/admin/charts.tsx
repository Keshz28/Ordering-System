"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "@/lib/utils";

/**
 * Shared chart chrome. One palette, one tooltip, one axis style so every chart
 * in the back office reads as part of the same system.
 */
export const PALETTE = [
  "#8B1E1E",
  "#C9A227",
  "#6B7A4A",
  "#B93A3A",
  "#8E9AA6",
  "#D9B74A",
  "#55603A",
];

const axisProps = {
  stroke: "#a8a29e",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-cream-400 bg-white px-3 py-2 shadow-[var(--shadow-lift)]">
      {label && <p className="text-xs font-medium text-ink-900">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="mt-0.5 flex items-center gap-1.5 text-xs">
          <span
            className="size-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-ink-500">{p.name}</span>
          <span className="font-semibold text-ink-900">
            {formatter && typeof p.value === "number"
              ? formatter(p.value)
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  description,
  children,
  action,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-cream-400 bg-white p-5 shadow-[var(--shadow-card)] ${className ?? ""}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          {description && (
            <p className="text-xs text-ink-500">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function RevenueTrend({
  data,
}: {
  data: { label: string; revenue: number; orders: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -18, right: 6, top: 4 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B1E1E" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#8B1E1E" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e2cd" vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
        <YAxis {...axisProps} tickFormatter={(v) => `$${v}`} width={54} />
        <Tooltip content={<ChartTooltip formatter={(v) => money(v)} />} />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#8B1E1E"
          strokeWidth={2}
          fill="url(#revenueFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HourlyBars({
  data,
}: {
  data: { label: string; revenue: number; orders: number }[];
}) {
  const max = Math.max(...data.map((d) => d.orders), 1);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -22, right: 6, top: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e2cd" vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval={1} />
        <YAxis {...axisProps} width={40} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="orders" name="Orders" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            // Heat encoding: busier hours read darker.
            <Cell
              key={i}
              fill={`rgba(139, 30, 30, ${0.25 + (d.orders / max) * 0.75})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  valueKey = "orders",
}: {
  data: { name: string; orders: number; revenue: number }[];
  valueKey?: "orders" | "revenue";
}) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <PieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey="name"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          content={
            <ChartTooltip
              formatter={(v) => (valueKey === "revenue" ? money(v) : String(v))}
            />
          }
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span className="text-xs text-ink-700">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({
  data,
  dataKey = "units",
  color = "#8B1E1E",
  format = "number",
}: {
  data: { name: string; units: number; revenue: number }[];
  dataKey?: "units" | "revenue";
  color?: string;
  /** Declarative, not a function — this component is rendered from a Server
   *  Component and React cannot serialize callbacks across that boundary. */
  format?: "number" | "money";
}) {
  const formatter =
    format === "money" ? (v: number) => money(v) : (v: number) => String(v);

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 6, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e2cd" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={formatter} />
        <YAxis
          type="category"
          dataKey="name"
          {...axisProps}
          width={150}
          tick={{ fontSize: 11, fill: "#57534e" }}
        />
        <Tooltip content={<ChartTooltip formatter={formatter} />} />
        <Bar dataKey={dataKey} fill={color} radius={[0, 6, 6, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function NewVsReturning({
  data,
}: {
  data: { label: string; new: number; returning: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -22, right: 6, top: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e2cd" vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={20} />
        <YAxis {...axisProps} width={40} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span className="text-xs text-ink-700">{v}</span>}
        />
        <Bar dataKey="new" name="New" stackId="a" fill="#8B1E1E" radius={[0, 0, 0, 0]} />
        <Bar
          dataKey="returning"
          name="Returning"
          stackId="a"
          fill="#C9A227"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LtvLine({
  data,
}: {
  data: { label: string; ltv: number; customers: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: -18, right: 6, top: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0e2cd" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => `$${v}`} width={54} />
        <Tooltip content={<ChartTooltip formatter={(v) => money(v)} />} />
        <Line
          type="monotone"
          dataKey="ltv"
          name="Revenue per customer"
          stroke="#6B7A4A"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#6B7A4A" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
