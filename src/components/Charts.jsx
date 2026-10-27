import { compactMoney } from "../lib";

function smoothLine(points) {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index === 0 ? index : index - 1];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] || next;
    const cp1x = current.x + (next.x - previous.x) / 6;
    const cp1y = current.y + (next.y - previous.y) / 6;
    const cp2x = next.x - (after.x - current.x) / 6;
    const cp2y = next.y - (after.y - current.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }

  return path;
}

export function RevenueChart({ points }) {
  const width = 680;
  const height = 250;
  const pad = { left: 54, right: 12, top: 16, bottom: 32 };
  const data = points?.length ? points : [{ label: "—", revenue: 0, shipments: 0 }];
  const maxRevenue = Math.max(...data.map((point) => point.revenue), 1);
  const maxShipments = Math.max(...data.map((point) => point.shipments), 1);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xAt = (index) =>
    pad.left + (data.length <= 1 ? innerW / 2 : (index / (data.length - 1)) * innerW);
  const yAt = (value, max) => pad.top + innerH - (value / max) * innerH;

  const revenue = data.map((point, index) => ({
    x: xAt(index),
    y: yAt(point.revenue, maxRevenue),
  }));
  const shipments = data.map((point, index) => ({
    x: xAt(index),
    y: yAt(point.shipments, maxShipments),
  }));
  const revenuePath = smoothLine(revenue);
  const area = `${revenuePath} L ${revenue[revenue.length - 1].x} ${pad.top + innerH} L ${revenue[0].x} ${pad.top + innerH} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue and shipment volume">
      <defs>
        <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5a524" stopOpacity="0.45" />
          <stop offset="80%" stopColor="#f5a524" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#f5a524" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => {
        const y = yAt(maxRevenue * tick, maxRevenue);
        return (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="grid-line" />
            <text x={pad.left - 8} y={y + 4} className="axis-label" textAnchor="end">
              {compactMoney(maxRevenue * tick)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#goldFill)" />
      <path d={smoothLine(shipments)} className="series-shipments" />
      <path d={revenuePath} className="series-revenue" />
      {data.map((point, index) => (
        <text key={point.label} x={xAt(index)} y={height - 8} className="axis-label" textAnchor="middle">
          {point.label}
        </text>
      ))}
    </svg>
  );
}

const STATUS_COLORS = {
  DELIVERED: "#f5a524",
  COMPLETED: "#ffd27a",
  IN_TRANSIT: "#d4892a",
  DISPATCHED: "#8d5a22",
  CREATED: "#6a5340",
  CANCELLED: "#3f3f46",
  RESERVED: "#c9a227",
};

export function statusColor(status, index = 0) {
  return STATUS_COLORS[status] || ["#f5a524", "#c47b12", "#8d5a22", "#5c4632", "#3f3f46"][index % 5];
}

export function StatusDonut({ segments }) {
  const visible = (segments || []).filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 200 200" className="donut" role="img" aria-label="Shipment status distribution">
        <circle cx="100" cy="100" r={radius} className="donut-track" />
        {total > 0
          ? visible.map((segment) => {
              const length = (segment.value / total) * circumference;
              const gap = visible.length > 1 ? 6 : 0;
              const dash = Math.max(length - gap, 1);
              const node = (
                <circle
                  key={segment.label}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="18"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 100 100)"
                />
              );
              offset += length;
              return node;
            })
          : null}
      </svg>
      <div className="donut-legend">
        {visible.length === 0 ? <span>No trips yet</span> : null}
        {visible.map((segment) => (
          <span key={segment.label}>
            <i style={{ background: segment.color }} />
            {segment.label.replaceAll("_", " ")} · {segment.value}
          </span>
        ))}
      </div>
    </div>
  );
}
