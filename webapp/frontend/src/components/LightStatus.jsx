// Light on/off badge. Pairs an icon + text label with the color, so the state
// is never communicated by color alone (accessibility).
export default function LightStatus({ isOn, percent, threshold }) {
  if (isOn == null) {
    return (
      <div className="light-badge light-unknown">
        <span className="light-icon">•</span> No data
      </div>
    );
  }
  return (
    <div className={`light-badge ${isOn ? "light-on" : "light-off"}`}>
      <span className="light-icon">{isOn ? "☀" : "☾"}</span>
      Light {isOn ? "ON" : "OFF"}
      {percent != null && (
        <span className="light-meta">
          {percent.toFixed(0)}% · thr {threshold}%
        </span>
      )}
    </div>
  );
}
