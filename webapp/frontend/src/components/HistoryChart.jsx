import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useDarkMode, chartColors } from "../theme.js";

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

function CustomTooltip({ active, payload, unit, colors }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const value = p.value;
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.axis}`,
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 13,
        color: colors.text,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ color: colors.muted, marginBottom: 2 }}>
        {timeFmt.format(new Date(p.payload.t))}
      </div>
      <div style={{ fontWeight: 600, color: p.color }}>
        {value == null ? "—" : `${value.toFixed(1)}${unit}`}
      </div>
    </div>
  );
}

// `data` is an array of { t: epochMs, value: number|null }.
export default function HistoryChart({ title, data, color, unit }) {
  const dark = useDarkMode();
  const colors = chartColors(dark);

  return (
    <section className="card chart-card">
      <h2 className="chart-title">{title}</h2>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 4, left: -8 }}
          >
            <CartesianGrid
              stroke={colors.grid}
              strokeDasharray="0"
              vertical={false}
            />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t) => timeFmt.format(new Date(t))}
              minTickGap={48}
              tick={{ fill: colors.muted, fontSize: 12 }}
              stroke={colors.axis}
              tickLine={false}
            />
            <YAxis
              width={48}
              tick={{ fill: colors.muted, fontSize: 12 }}
              stroke={colors.axis}
              tickLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(v) => `${v}${unit}`}
            />
            <Tooltip
              content={<CustomTooltip unit={unit} colors={colors} />}
              cursor={{ stroke: colors.muted, strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
