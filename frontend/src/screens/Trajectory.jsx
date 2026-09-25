import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import { useTrajectory } from '../api/hooks';
import { SkeletonBlock } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StatePanel';
import { downloadCsv } from '../utils/csv';

const DEFAULT_CENTER = [28.6139, 77.209]; // Delhi (Connaught Place area)
const DEFAULT_ZOOM = 11;
const PLAYBACK_INTERVAL_MS = 1200;
// Esri's dark-gray canvas basemap — free and keyless, unlike CARTO's basemap tiles
// (which now gate anonymous access and serve an "API KEY REQUIRED" watermark tile).
const DARK_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const DARK_TILE_ATTRIBUTION = '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

function confidenceStyle(a, b) {
  const confidence = Math.min(a.properties.confidence, b.properties.confidence);
  const isFuzzy = a.properties.fuzzy_score < 1 || b.properties.fuzzy_score < 1;
  return {
    color: '#39ff14',
    weight: confidence < 0.85 ? 2 : 3,
    opacity: confidence < 0.7 ? 0.35 : confidence < 0.85 ? 0.6 : 0.9,
    dashArray: confidence < 0.85 || isFuzzy ? '6 8' : undefined,
  };
}

function FitToBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
    } else {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [map, points]);
  return null;
}

function FilmstripThumb({ waypoint, active, onClick }) {
  const [failed, setFailed] = useState(false);
  const imageRef = waypoint.properties.image_ref;

  return (
    <button
      className={`filmstrip-thumb${active ? ' active' : ''}`}
      onClick={onClick}
      title={waypoint.properties.timestamp}
    >
      {imageRef && !failed ? (
        <img src={imageRef} alt={waypoint.properties.plate_read} onError={() => setFailed(true)} />
      ) : (
        <div className="filmstrip-fallback">
          <span>NO IMAGE</span>
        </div>
      )}
      <span className="filmstrip-cam mono">{waypoint.properties.camera_id}</span>
    </button>
  );
}

export default function Trajectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const plateFromUrl = searchParams.get('plate') || '';

  const [plateInput, setPlateInput] = useState(plateFromUrl);
  const [searchedPlate, setSearchedPlate] = useState(plateFromUrl.toUpperCase());
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef(null);

  // Deep-link support: `/trajectory?plate=XYZ` pre-fills and auto-searches.
  useEffect(() => {
    if (plateFromUrl && plateFromUrl.toUpperCase() !== searchedPlate) {
      setPlateInput(plateFromUrl);
      setSearchedPlate(plateFromUrl.toUpperCase());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateFromUrl]);

  const trajectoryQuery = useTrajectory(searchedPlate);

  const waypoints = useMemo(() => {
    const features = trajectoryQuery.data?.features || [];
    return features
      .filter((f) => f.geometry.type === 'Point')
      .slice()
      .sort((a, b) => new Date(a.properties.timestamp) - new Date(b.properties.timestamp));
  }, [trajectoryQuery.data]);

  const routeLine = useMemo(() => {
    const features = trajectoryQuery.data?.features || [];
    return features.find((f) => f.geometry.type === 'LineString');
  }, [trajectoryQuery.data]);

  const routePositions = useMemo(() => {
    if (!routeLine) return [];
    return routeLine.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  }, [routeLine]);

  const allPoints = useMemo(
    () => waypoints.map((w) => [w.geometry.coordinates[1], w.geometry.coordinates[0]]),
    [waypoints]
  );

  useEffect(() => {
    setSelectedIndex(null);
    setPlaybackIndex(0);
    setIsPlaying(false);
  }, [searchedPlate]);

  useEffect(() => {
    if (!isPlaying) {
      clearInterval(timerRef.current);
      return undefined;
    }
    timerRef.current = setInterval(() => {
      setPlaybackIndex((prev) => {
        if (prev >= waypoints.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, PLAYBACK_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [isPlaying, waypoints.length]);

  function handleSearch(e) {
    e.preventDefault();
    const normalized = plateInput.trim().toUpperCase();
    setSearchedPlate(normalized);
    setSearchParams(normalized ? { plate: normalized } : {});
  }

  function handleExportCsv() {
    downloadCsv(
      `trajectory-${searchedPlate}.csv`,
      waypoints.map((w) => ({
        camera_id: w.properties.camera_id,
        timestamp: w.properties.timestamp,
        plate_read: w.properties.plate_read,
        confidence: w.properties.confidence,
        fuzzy_score: w.properties.fuzzy_score,
        lat: w.geometry.coordinates[1],
        lon: w.geometry.coordinates[0],
      }))
    );
  }

  const activeIndex = selectedIndex != null ? selectedIndex : playbackIndex;
  const activeWaypoint = waypoints[activeIndex];

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Trajectory Query</h1>
          <p>Reconstructed camera-hit sequence with fuzzy plate matching and speed-plausibility filtering</p>
        </div>
      </header>

      <form className="glass-card filter-card" style={{ marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-end' }} onSubmit={handleSearch}>
        <div style={{ flex: 1 }}>
          <label className="field-label" style={{ marginTop: 0 }}>
            Plate Number
          </label>
          <input
            type="search"
            className="mono"
            placeholder="e.g. DL01AB1234 (partial matches ok)"
            value={plateInput}
            onChange={(e) => setPlateInput(e.target.value)}
          />
        </div>
        <button className="btn" type="submit" disabled={!plateInput.trim()}>
          Search
        </button>
      </form>

      {!searchedPlate && (
        <div className="glass-card map-card">
          <EmptyState variant="info" title="Search a plate to begin" message="Partial and fuzzy matches (OCR confusions) are supported." />
        </div>
      )}

      {searchedPlate && trajectoryQuery.isLoading && (
        <div className="glass-card map-card">
          <SkeletonBlock height={520} />
        </div>
      )}

      {searchedPlate && trajectoryQuery.isError && (
        <div className="glass-card map-card">
          <ErrorState
            message={`Could not query trajectory for "${searchedPlate}"`}
            onRetry={() => trajectoryQuery.refetch()}
          />
        </div>
      )}

      {searchedPlate && trajectoryQuery.data && waypoints.length === 0 && (
        <div className="glass-card map-card">
          <EmptyState
            variant="empty-search"
            title={`No trajectory found for "${searchedPlate}"`}
            message="No camera reads matched this plate exactly or within fuzzy-match tolerance."
          />
        </div>
      )}

      {searchedPlate && waypoints.length > 0 && (
        <main className="main-grid">
          <section className="glass-card map-card">
            <div className="section-heading">
              <div>
                <h2>Route — {searchedPlate}</h2>
                <p>
                  {waypoints.length} camera hits
                  {routeLine ? (routeLine.properties.snapped ? ' · road-snapped via OSRM' : ' · straight-line fallback (OSRM unreachable)') : ''}
                </p>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={handleExportCsv}>
                ⭳ Export CSV
              </button>
            </div>

            <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom className="traffic-map">
              <TileLayer attribution={DARK_TILE_ATTRIBUTION} url={DARK_TILE_URL} />
              <FitToBounds points={allPoints} />

              {routePositions.length > 1 && (
                <Polyline positions={routePositions} pathOptions={{ color: '#1d7a0c', weight: 2, opacity: 0.5, dashArray: '2 6' }} />
              )}

              {waypoints.slice(0, -1).map((wp, i) => (
                <Polyline
                  key={`seg-${i}`}
                  positions={[allPoints[i], allPoints[i + 1]]}
                  pathOptions={confidenceStyle(waypoints[i], waypoints[i + 1])}
                />
              ))}

              {waypoints.map((wp, i) => (
                <CircleMarker
                  key={`${wp.properties.camera_id}-${wp.properties.timestamp}`}
                  center={allPoints[i]}
                  radius={i === activeIndex ? 11 : 7}
                  pathOptions={{
                    color: '#39ff14',
                    fillColor: i <= activeIndex ? '#39ff14' : '#0a0d0a',
                    fillOpacity: wp.properties.confidence < 0.7 ? 0.4 : 0.9,
                    weight: i === activeIndex ? 3 : 1.5,
                  }}
                  eventHandlers={{ click: () => setSelectedIndex(i) }}
                >
                  <Popup>
                    <strong className="mono">{wp.properties.camera_id}</strong>
                    <br />
                    {new Date(wp.properties.timestamp).toLocaleString()}
                    <br />
                    Confidence: {(wp.properties.confidence * 100).toFixed(0)}%
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>

            <div className="playback-bar">
              <button
                className="btn btn-sm"
                onClick={() => {
                  setSelectedIndex(null);
                  setIsPlaying((p) => !p);
                }}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(waypoints.length - 1, 0)}
                value={playbackIndex}
                onChange={(e) => {
                  setSelectedIndex(null);
                  setIsPlaying(false);
                  setPlaybackIndex(Number(e.target.value));
                }}
                className="playback-slider"
              />
              <span className="mono playback-index">
                {activeIndex + 1} / {waypoints.length}
              </span>
            </div>

            <div className="field-label" style={{ marginTop: 20 }}>
              Plate-Crop Filmstrip
            </div>
            <div className="filmstrip">
              {waypoints.map((wp, i) => (
                <FilmstripThumb
                  key={`thumb-${i}`}
                  waypoint={wp}
                  active={i === activeIndex}
                  onClick={() => setSelectedIndex(i)}
                />
              ))}
            </div>
            <p style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 8 }}>
              No image store is wired up yet — thumbnails will show "NO IMAGE" until real plate-crop URLs are available.
            </p>
          </section>

          <aside className="glass-card filter-card">
            <h2>Hit Detail</h2>
            {activeWaypoint ? (
              <dl className="detail-list mono">
                <dt>Camera</dt>
                <dd>{activeWaypoint.properties.camera_id}</dd>
                <dt>Timestamp</dt>
                <dd>{new Date(activeWaypoint.properties.timestamp).toLocaleString()}</dd>
                <dt>Plate Read</dt>
                <dd>{activeWaypoint.properties.plate_read}</dd>
                <dt>Confidence</dt>
                <dd>{(activeWaypoint.properties.confidence * 100).toFixed(1)}%</dd>
                <dt>Fuzzy Score</dt>
                <dd>{activeWaypoint.properties.fuzzy_score.toFixed(2)}</dd>
              </dl>
            ) : (
              <EmptyState variant="info" title="No point selected" message="Click a camera marker or filmstrip frame." />
            )}
          </aside>
        </main>
      )}
    </div>
  );
}
