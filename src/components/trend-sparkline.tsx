import { useId } from "react";

export interface TrendSparklinePoint {
  label: string;
  value: number;
}

export const TrendSparkline = ({
  points,
  ariaLabel,
  className = "text-lime-700"
}: {
  points: TrendSparklinePoint[];
  ariaLabel: string;
  className?: string;
}) => {
  const gradientId = useId().replace(/:/g, "");
  if (points.length < 2) return null;

  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const coordinates = points.map((point, index) => ({
    x: 10 + (index / (points.length - 1)) * 300,
    y: 96 - ((point.value - minimum) / range) * 72
  }));
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const area = `M ${coordinates[0].x} 104 L ${coordinates.map(({ x, y }) => `${x} ${y}`).join(" L ")} L ${coordinates.at(-1)!.x} 104 Z`;
  const latest = coordinates.at(-1)!;

  return (
    <svg className={`h-24 w-full overflow-visible ${className}`} viewBox="0 0 320 112" role="img" aria-label={ariaLabel}>
      <title>{ariaLabel}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="10" x2="310" y1="104" y2="104" stroke="currentColor" strokeOpacity="0.14" />
      <line x1="10" x2="310" y1="68" y2="68" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="3 5" />
      <path d={area} fill={`url(#${gradientId})`} />
      <polyline points={line} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
      <circle cx={latest.x} cy={latest.y} r="5" fill="white" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
};
