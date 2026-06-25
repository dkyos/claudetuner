// Dependency-free SVG line+area chart for a 0–100% utilization time series.
// Server component (static markup) — mirrors the popup's chart intent (ui/charts.js)
// with optional dashed projection-to-reset line.
export interface Pt {
  t: number; // epoch ms
  v: number; // utilization 0–100
}

function fmtDate(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function UsageChart({
  points,
  color,
  prediction,
  height = 200,
}: {
  points: Pt[];
  color: string;
  prediction?: Pt | null;
  height?: number;
}) {
  const W = 680;
  const H = height;
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 26;

  if (points.length === 0) {
    return (
      <div style={{ color: "#6b7280", padding: "24px 0", fontSize: 13 }}>
        아직 데이터가 없습니다.
      </div>
    );
  }

  const ts = points.map((p) => p.t);
  let tMin = Math.min(...ts);
  let tMax = Math.max(...ts);
  if (prediction) tMax = Math.max(tMax, prediction.t);
  if (tMax === tMin) tMax = tMin + 1;

  const x = (t: number) =>
    padL + ((t - tMin) / (tMax - tMin)) * (W - padL - padR);
  const y = (v: number) =>
    padT + (1 - Math.min(Math.max(v, 0), 100) / 100) * (H - padT - padB);

  const linePts = points.map((p) => `${x(p.t)},${y(p.v)}`).join(" ");
  const areaPath =
    `M${x(points[0].t)},${y(0)} ` +
    points.map((p) => `L${x(p.t)},${y(p.v)}`).join(" ") +
    ` L${x(points[points.length - 1].t)},${y(0)} Z`;

  const last = points[points.length - 1];
  const guides = [50, 80, 100];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block" }}
      role="img"
    >
      {/* horizontal guide lines */}
      {guides.map((g) => (
        <g key={g}>
          <line
            x1={padL}
            y1={y(g)}
            x2={W - padR}
            y2={y(g)}
            stroke={g === 100 ? "#ef444455" : "#2a2f3a"}
            strokeWidth={1}
            strokeDasharray={g === 100 ? "5 4" : "2 4"}
          />
          <text x={4} y={y(g) + 3} fill="#6b7280" fontSize={9}>
            {g}%
          </text>
        </g>
      ))}

      {/* area + line */}
      <path d={areaPath} fill={color} opacity={0.13} />
      <polyline
        points={linePts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* projection to reset (dashed) */}
      {prediction && (
        <>
          <line
            x1={x(last.t)}
            y1={y(last.v)}
            x2={x(prediction.t)}
            y2={y(prediction.v)}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.8}
          />
          <circle
            cx={x(prediction.t)}
            cy={y(prediction.v)}
            r={3}
            fill={color}
          />
        </>
      )}

      {/* x-axis labels: start / end */}
      <text x={padL} y={H - 8} fill="#6b7280" fontSize={9}>
        {fmtDate(tMin)}
      </text>
      <text x={W - padR} y={H - 8} fill="#6b7280" fontSize={9} textAnchor="end">
        {fmtDate(tMax)}
      </text>
    </svg>
  );
}
