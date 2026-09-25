export function SkeletonText({ width }) {
  return <div className="skeleton skeleton-text" style={width ? { width } : undefined} />;
}

export function SkeletonBlock({ height }) {
  return <div className="skeleton skeleton-block" style={height ? { height } : undefined} />;
}

export function KpiSkeleton() {
  return (
    <div className="glass-card kpi-card">
      <SkeletonText width="60%" />
      <SkeletonBlock height={30} />
    </div>
  );
}
