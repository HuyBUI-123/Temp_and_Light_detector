// A single current-value tile: label, big value, unit. `accent` colors a thin
// top rule so each metric is identifiable without relying on the number alone.
export default function StatCard({ label, value, unit, accent, sub }) {
  const display =
    value == null || Number.isNaN(value) ? "—" : Number(value).toFixed(1);
  return (
    <section className="card stat-card">
      <div className="stat-accent" style={{ background: accent }} />
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {display}
        <span className="stat-unit">{unit}</span>
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </section>
  );
}
