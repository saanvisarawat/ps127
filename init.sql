CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE cameras (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lon, lat), 4326)) STORED
);
CREATE INDEX idx_cameras_geom ON cameras USING GIST(geom);

-- Fixed camera install locations (dimension data, not simulated readings) —
-- self-captured footage sources spread across Delhi.
-- IDs match the segments used by tools/seed_historical_analytics.py.
INSERT INTO cameras (id, name, lat, lon) VALUES
    ('CAM_01', 'Connaught Place', 28.6315, 77.2167),
    ('CAM_02', 'India Gate', 28.6129, 77.2295),
    ('CAM_03', 'Chandni Chowk', 28.6506, 77.2334),
    ('CAM_04', 'Karol Bagh', 28.6519, 77.1909),
    ('CAM_05', 'Lajpat Nagar', 28.5677, 77.2431),
    ('CAM_06', 'Dwarka Sector 21', 28.5921, 77.0460);

CREATE TABLE vehicle_tracks (
    track_id INT,
    camera_id VARCHAR(32) REFERENCES cameras(id),
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    plate_text_final VARCHAR(16) NOT NULL,
    confidence_avg FLOAT NOT NULL,
    PRIMARY KEY (track_id, camera_id, first_seen)
);

CREATE TABLE raw_reads (
    id BIGSERIAL PRIMARY KEY,
    camera_id VARCHAR(32) REFERENCES cameras(id),
    track_id INT,
    plate_text VARCHAR(16) NOT NULL,
    confidence FLOAT NOT NULL,
    frame_ts TIMESTAMPTZ NOT NULL,
    image_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_raw_reads_plate ON raw_reads(plate_text);
CREATE INDEX idx_raw_reads_ts ON raw_reads(frame_ts DESC);

CREATE TABLE trajectories (
    id BIGSERIAL PRIMARY KEY,
    plate_text VARCHAR(16) NOT NULL,
    ordered_waypoints JSONB NOT NULL
);

CREATE TABLE blacklist (
    plate_text VARCHAR(16) PRIMARY KEY,
    reason TEXT NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'HIGH'
);

CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    plate_text VARCHAR(16) NOT NULL,
    camera_id VARCHAR(32),
    type VARCHAR(32) NOT NULL,
    confidence FLOAT,
    severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(16) NOT NULL DEFAULT 'NEW',
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    explanation JSONB NOT NULL,
    ts TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_alerts_ts ON alerts(ts DESC);

CREATE TABLE analytics_cache (
    id BIGSERIAL PRIMARY KEY,
    metric_type VARCHAR(32) NOT NULL,
    node_or_segment_id VARCHAR(64),
    time_bucket TIMESTAMPTZ,
    value JSONB NOT NULL
);
CREATE INDEX idx_analytics_cache_lookup ON analytics_cache(metric_type, node_or_segment_id);