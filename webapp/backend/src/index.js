import express from "express";
import cors from "cors";

import { query, pool } from "./db.js";
import { startCleanupJob } from "./cleanup.js";

// --- Config -----------------------------------------------------------------
const PORT = parseInt(process.env.PORT || "8000", 10);
const LIGHT_ON_THRESHOLD = parseFloat(process.env.LIGHT_ON_THRESHOLD || "50");
const RETENTION_HOURS = parseInt(process.env.RETENTION_HOURS || "24", 10);
const CLEANUP_INTERVAL_MINUTES = parseInt(
  process.env.CLEANUP_INTERVAL_MINUTES || "10",
  10
);

const app = express();
app.use(cors());
app.use(express.json());

// --- Helpers ----------------------------------------------------------------

// Validate that a value is either absent (null/undefined) or a finite number.
function optionalNumber(value) {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN; // NaN signals an invalid (non-numeric) input
}

// --- Routes -----------------------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Ingest a reading from a device.
app.post("/api/readings", async (req, res) => {
  const body = req.body || {};
  const device_id = body.device_id;

  if (typeof device_id !== "string" || device_id.trim() === "") {
    return res.status(400).json({ error: "device_id is required" });
  }

  const temperature = optionalNumber(body.temperature);
  const humidity = optionalNumber(body.humidity);
  const light_raw = optionalNumber(body.light_raw);
  const light_percent = optionalNumber(body.light_percent);

  if ([temperature, humidity, light_raw, light_percent].some(Number.isNaN)) {
    return res.status(400).json({ error: "numeric fields must be numbers" });
  }

  try {
    const result = await query(
      `INSERT INTO readings (device_id, temperature, humidity, light_raw, light_percent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, recorded_at`,
      [device_id, temperature, humidity, light_raw, light_percent]
    );
    res.status(201).json({ status: "ok", ...result.rows[0] });
  } catch (err) {
    console.error("Insert failed:", err.message);
    res.status(500).json({ error: "database error" });
  }
});

// Latest reading (optionally for a specific device), with computed light state.
app.get("/api/current", async (req, res) => {
  const { device_id } = req.query;
  try {
    const result = await query(
      `SELECT device_id, temperature, humidity, light_raw, light_percent, recorded_at
         FROM readings
        WHERE ($1::text IS NULL OR device_id = $1)
        ORDER BY recorded_at DESC
        LIMIT 1`,
      [device_id || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "no readings yet" });
    }

    const row = result.rows[0];
    const is_on =
      row.light_percent === null
        ? null
        : row.light_percent >= LIGHT_ON_THRESHOLD;

    res.json({ ...row, is_on, light_threshold: LIGHT_ON_THRESHOLD });
  } catch (err) {
    console.error("Current query failed:", err.message);
    res.status(500).json({ error: "database error" });
  }
});

// History points for the graphs. Defaults to the retention window (24h).
app.get("/api/history", async (req, res) => {
  const { device_id } = req.query;
  let hours = parseInt(req.query.hours || String(RETENTION_HOURS), 10);
  if (!Number.isFinite(hours) || hours <= 0) hours = RETENTION_HOURS;
  hours = Math.min(hours, RETENTION_HOURS); // can't return data we don't keep

  try {
    const result = await query(
      `SELECT recorded_at, temperature, humidity, light_percent
         FROM readings
        WHERE recorded_at >= now() - make_interval(hours => $1)
          AND ($2::text IS NULL OR device_id = $2)
        ORDER BY recorded_at ASC`,
      [hours, device_id || null]
    );
    res.json({ hours, points: result.rows });
  } catch (err) {
    console.error("History query failed:", err.message);
    res.status(500).json({ error: "database error" });
  }
});

// Distinct devices that have reported (for future multi-device UI).
app.get("/api/devices", async (req, res) => {
  try {
    const result = await query(
      `SELECT device_id, max(recorded_at) AS last_seen
         FROM readings
        GROUP BY device_id
        ORDER BY last_seen DESC`
    );
    res.json({ devices: result.rows });
  } catch (err) {
    console.error("Devices query failed:", err.message);
    res.status(500).json({ error: "database error" });
  }
});

// --- Startup ----------------------------------------------------------------

const server = app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
  console.log(
    `Light on/off threshold: ${LIGHT_ON_THRESHOLD}%  |  retention: ${RETENTION_HOURS}h`
  );
  startCleanupJob(RETENTION_HOURS, CLEANUP_INTERVAL_MINUTES);
});

// Graceful shutdown so docker stop / restart is clean.
async function shutdown() {
  console.log("Shutting down...");
  server.close();
  await pool.end().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
