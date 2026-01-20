import type { ReactNode } from "react";

export function SparkBars({
  data,
  height = 120,
  renderLabel
}: {
  data: Array<{ value: number; label: string }>;
  height?: number;
  renderLabel?: (value: number) => ReactNode;
}) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));

  return (
    <div className="spark-bars" style={{ height }}>
      {data.map((point) => {
        const size = Math.max(6, (Math.abs(point.value) / max) * height);
        return (
          <div key={point.label} className="spark-bars__item">
            <div
              className={`spark-bars__bar${point.value < 0 ? " is-negative" : ""}`}
              style={{ height: `${size}px` }}
            />
            {renderLabel ? <div className="spark-bars__label">{renderLabel(point.value)}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

export function SparkLine({
  data,
  height = 120,
  width = 520
}: {
  data: Array<{ value: number }>;
  height?: number;
  width?: number;
}) {
  if (data.length === 0) {
    return <div className="spark-line empty" />;
  }
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;

  const points = data
    .map((point, index) => {
      const x = (index / Math.max(1, data.length - 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="spark-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
