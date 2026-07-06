import { useCallback, useEffect, useState } from "react";
import { getCurrent, getHistory } from "./api.js";
import { useDarkMode, chartColors } from "./theme.js";
import StatCard from "./components/StatCard.jsx";
import LightStatus from "./components/LightStatus.jsx";
import HistoryChart from "./components/HistoryChart.jsx";

const CURRENT_INTERVAL = 15000; // 15s
const HISTORY_INTERVAL = 60000; // 60s

const clockFmt = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export default function App() {
  const dark = useDarkMode();
  const colors = chartColors(dark);

  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState({ points: [] });
  const [error, setError] = useState(null);

  const refreshCurrent = useCallback(async () => {
    try {
      setCurrent(await getCurrent());
      setError(null);
    } catch (err) {
      // A 404 just means no readings yet — not a hard error.
      if (String(err.message).startsWith("404")) {
        setCurrent(null);
      } else {
        setError(err.message);
      }
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await getHistory(24));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refreshCurrent();
    refreshHistory();
    const c = setInterval(refreshCurrent, CURRENT_INTERVAL);
    const h = setInterval(refreshHistory, HISTORY_INTERVAL);
    return () => {
      clearInterval(c);
      clearInterval(h);
    };
  }, [refreshCurrent, refreshHistory]);

  const points = history.points || [];
  const tempData = points.map((p) => ({
    t: new Date(p.recorded_at).getTime(),
    value: p.temperature,
  }));
  const humData = points.map((p) => ({
    t: new Date(p.recorded_at).getTime(),
    value: p.humidity,
  }));

  const updatedAt = current?.recorded_at
    ? clockFmt.format(new Date(current.recorded_at))
    : "—";

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Temp &amp; Light</h1>
          <p className="subtitle">
            {current
              ? `Last reading ${updatedAt}`
              : "Waiting for the first reading…"}
          </p>
        </div>
        <LightStatus
          isOn={current?.is_on ?? null}
          percent={current?.light_percent ?? null}
          threshold={current?.light_threshold}
        />
      </header>

      {error && (
        <div className="error-banner">Can&apos;t reach the API: {error}</div>
      )}

      <div className="stat-grid">
        <StatCard
          label="Temperature"
          value={current?.temperature}
          unit="°C"
          accent={colors.temp}
        />
        <StatCard
          label="Humidity"
          value={current?.humidity}
          unit="%"
          accent={colors.humidity}
        />
        <StatCard
          label="Light"
          value={current?.light_percent}
          unit="%"
          accent={colors.muted}
          sub={
            current?.is_on == null
              ? null
              : current.is_on
                ? "above threshold"
                : "below threshold"
          }
        />
      </div>

      <HistoryChart
        title="Temperature · last 24h"
        data={tempData}
        color={colors.temp}
        unit="°C"
      />
      <HistoryChart
        title="Humidity · last 24h"
        data={humData}
        color={colors.humidity}
        unit="%"
      />
    </div>
  );
}
