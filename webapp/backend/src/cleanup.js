import { query } from "./db.js";

// Delete readings older than the retention window. Runs on an interval so the
// database never grows past ~RETENTION_HOURS worth of data.
export async function cleanupOldReadings(retentionHours) {
  const result = await query(
    "DELETE FROM readings WHERE recorded_at < now() - make_interval(hours => $1)",
    [retentionHours]
  );
  return result.rowCount;
}

export function startCleanupJob(retentionHours, intervalMinutes) {
  const run = async () => {
    try {
      const deleted = await cleanupOldReadings(retentionHours);
      if (deleted > 0) {
        console.log(`Cleanup: removed ${deleted} reading(s) older than ${retentionHours}h`);
      }
    } catch (err) {
      console.error("Cleanup job failed:", err.message);
    }
  };

  // Run once shortly after startup, then on the interval.
  setTimeout(run, 5000);
  setInterval(run, intervalMinutes * 60 * 1000);
}
