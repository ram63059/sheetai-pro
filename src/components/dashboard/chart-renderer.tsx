"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { AlertCircle, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartRendererProps {
  config: string;
}

interface ChartDataItem {
  [key: string]: string | number;
}

interface ChartConfig {
  type: "bar" | "line" | "area" | "pie";
  title?: string;
  data: ChartDataItem[];
  xKey?: string;
  yKeys?: string[];
  nameKey?: string;
  valueKey?: string;
}

// Emerald/teal color palette matching design language
const CHART_COLORS = [
  "#10b981", // emerald-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  "#0ea5e9", // sky-500
  "#8b5cf6", // violet-500
  "#f59e0b", // amber-500
  "#f97316", // orange-500
  "#ef4444", // red-500
];

const GRADIENT_DEFS = (
  <defs>
    {CHART_COLORS.map((color, idx) => (
      <linearGradient
        key={idx}
        id={`chartGradient${idx}`}
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop offset="0%" stopColor={color} stopOpacity={0.4} />
        <stop offset="100%" stopColor={color} stopOpacity={0.05} />
      </linearGradient>
    ))}
  </defs>
);

function parseChartConfig(configStr: string): ChartConfig | null {
  try {
    const parsed = JSON.parse(configStr) as ChartConfig;
    if (!parsed.type || !parsed.data || !Array.isArray(parsed.data)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function ChartErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 px-6 py-10">
      <AlertCircle className="mb-3 h-8 w-8 text-red-400" />
      <p className="text-sm font-medium text-red-600">
        Unable to render chart
      </p>
      <p className="mt-1 text-xs text-red-400">{message}</p>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
    fontSize: "13px",
    padding: "8px 12px",
  },
  cursor: { fill: "rgba(16, 185, 129, 0.05)" },
};

function BarChartView({
  config,
}: {
  config: ChartConfig;
}) {
  const xKey = config.xKey ?? Object.keys(config.data[0])[0];
  const yKeys =
    config.yKeys ??
    Object.keys(config.data[0]).filter((k) => k !== xKey);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={config.data} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...tooltipStyle} />
        {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: "12px" }} />}
        {yKeys.map((key, idx) => (
          <Bar
            key={key}
            dataKey={key}
            fill={CHART_COLORS[idx % CHART_COLORS.length]}
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartView({
  config,
}: {
  config: ChartConfig;
}) {
  const xKey = config.xKey ?? Object.keys(config.data[0])[0];
  const yKeys =
    config.yKeys ??
    Object.keys(config.data[0]).filter((k) => k !== xKey);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={config.data} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...tooltipStyle} />
        {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: "12px" }} />}
        {yKeys.map((key, idx) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
            strokeWidth={2.5}
            dot={{ r: 4, fill: "white", strokeWidth: 2.5 }}
            activeDot={{ r: 6, strokeWidth: 0, fill: CHART_COLORS[idx % CHART_COLORS.length] }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaChartView({
  config,
}: {
  config: ChartConfig;
}) {
  const xKey = config.xKey ?? Object.keys(config.data[0])[0];
  const yKeys =
    config.yKeys ??
    Object.keys(config.data[0]).filter((k) => k !== xKey);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={config.data} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
        {GRADIENT_DEFS}
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...tooltipStyle} />
        {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: "12px" }} />}
        {yKeys.map((key, idx) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
            strokeWidth={2.5}
            fill={`url(#chartGradient${idx % CHART_COLORS.length})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PieChartView({
  config,
}: {
  config: ChartConfig;
}) {
  const nameKey = config.nameKey ?? config.xKey ?? Object.keys(config.data[0])[0];
  const valueKey =
    config.valueKey ??
    (config.yKeys?.[0]) ??
    Object.keys(config.data[0]).find((k) => k !== nameKey) ??
    Object.keys(config.data[0])[1];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={config.data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={110}
          paddingAngle={3}
          dataKey={valueKey}
          nameKey={nameKey}
          stroke="none"
        >
          {config.data.map((_, idx) => (
            <Cell
              key={idx}
              fill={CHART_COLORS[idx % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "12px" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ChartRenderer({ config: configStr }: ChartRendererProps) {
  const config = useMemo(() => parseChartConfig(configStr), [configStr]);

  if (!config) {
    return (
      <ChartErrorState message="Invalid chart configuration received" />
    );
  }

  if (config.data.length === 0) {
    return <ChartErrorState message="No data available for chart" />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm"
    >
      {/* Chart header */}
      {config.title && (
        <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3">
          <BarChart3 className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-slate-700">
            {config.title}
          </h3>
        </div>
      )}

      {/* Chart body */}
      <div className="p-4">
        {config.type === "bar" && <BarChartView config={config} />}
        {config.type === "line" && <LineChartView config={config} />}
        {config.type === "area" && <AreaChartView config={config} />}
        {config.type === "pie" && <PieChartView config={config} />}
      </div>
    </motion.div>
  );
}
