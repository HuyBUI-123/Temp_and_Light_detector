import pg from "pg";

const { Pool } = pg;

// DATABASE_URL is provided by docker-compose. For local dev without Docker,
// fall back to a sensible localhost default.
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://sensors:sensors@localhost:5432/sensors",
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error:", err);
});

export async function query(text, params) {
  return pool.query(text, params);
}
