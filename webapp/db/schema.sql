-- Schema for the Temp & Light detector.
-- This file is mounted into the Postgres container's docker-entrypoint-initdb.d
-- and runs automatically the first time the database volume is created.

CREATE TABLE IF NOT EXISTS readings (
    id             BIGSERIAL   PRIMARY KEY,
    device_id      TEXT        NOT NULL,
    temperature    REAL,                 -- degrees Celsius
    humidity       REAL,                 -- percent relative humidity
    light_raw      INTEGER,              -- raw ADC value 0..4095
    light_percent  REAL,                 -- 0..100
    recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Retention cleanup and the 24h history query both filter on recorded_at.
CREATE INDEX IF NOT EXISTS idx_readings_recorded_at
    ON readings (recorded_at);

-- "Latest reading for a device" and per-device history.
CREATE INDEX IF NOT EXISTS idx_readings_device_time
    ON readings (device_id, recorded_at DESC);
