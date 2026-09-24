import './App.css';

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap
} from 'react-leaflet';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

import { useEffect, useMemo, useState } from 'react';


// -------------------------
// Camera data
// -------------------------
const CAMERAS = [
  {
    id: 'CAM-001',
    position: [40.7128, -74.0060],
    status: 'Online',
    traffic: 'Medium',
    intensity: 0.8
  },
  {
    id: 'CAM-002',
    position: [40.7306, -73.9866],
    status: 'Online',
    traffic: 'High',
    intensity: 1.0
  },
  {
    id: 'CAM-003',
    position: [40.7060, -74.0086],
    status: 'Online',
    traffic: 'Low',
    intensity: 0.4
  },
  {
    id: 'CAM-004',
    position: [40.7484, -73.9857],
    status: 'Offline',
    traffic: 'High',
    intensity: 0.7
  }
];


// -------------------------
// Heatmap layer
// -------------------------
function HeatLayer({ cameras }) {
  const map = useMap();

  useEffect(() => {
    const heatPoints = cameras.map((camera) => [
      camera.position[0],
      camera.position[1],
      camera.intensity
    ]);

    const heat = L.heatLayer(heatPoints, {
      radius: 35,
      blur: 25,
      maxZoom: 15
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, cameras]);

  return null;
}


// -------------------------
// Main App
// -------------------------
function App() {
  const [timeRange, setTimeRange] = useState('Last 30 minutes');
  const [cameraStatus, setCameraStatus] = useState('All Cameras');
  const [trafficDensity, setTrafficDensity] = useState('All');


  // Filter cameras according to selected filters
  const filteredCameras = useMemo(() => {
    return CAMERAS.filter((camera) => {
      const statusMatches =
        cameraStatus === 'All Cameras' ||
        camera.status === cameraStatus;

      const trafficMatches =
        trafficDensity === 'All' ||
        camera.traffic === trafficDensity;

      return statusMatches && trafficMatches;
    });
  }, [cameraStatus, trafficDensity]);


  return (
    <div className="dashboard">

      {/* ---------------- Header ---------------- */}
      <header className="header">
        <div>
          <h1>City Traffic Analytics</h1>
          <p>Real-time city traffic monitoring</p>
        </div>

        <div className="live-status">
          <span className="live-dot"></span>
          LIVE
        </div>
      </header>


      {/* ---------------- KPI Cards ---------------- */}
      <section className="kpi-grid">

        <div className="kpi-card">
          <p>Vehicles Tracked Today</p>
          <h2>12,450</h2>
          <span>+8.2% today</span>
        </div>

        <div className="kpi-card">
          <p>Average City Speed</p>
          <h2>42 km/h</h2>
          <span>City-wide average</span>
        </div>

        <div className="kpi-card">
          <p>Active Alerts</p>
          <h2>08</h2>
          <span>Requires attention</span>
        </div>

        <div className="kpi-card">
          <p>Cameras Online</p>
          <h2>48 / 52</h2>
          <span>92% operational</span>
        </div>

      </section>


      {/* ---------------- Main Content ---------------- */}
      <main className="main-grid">

        {/* ---------------- Map ---------------- */}
        <section className="map-card">

          <div className="section-heading">
            <div>
              <h2>Traffic Map</h2>
              <p>Live traffic density and camera locations</p>
            </div>

            <button>
              {timeRange === 'Last 30 minutes'
                ? 'Last 30 min ▾'
                : `${timeRange} ▾`}
            </button>
          </div>


          <MapContainer
            center={[40.7128, -74.0060]}
            zoom={12}
            scrollWheelZoom={true}
            className="traffic-map"
          >

            {/* Heatmap */}
            <HeatLayer cameras={filteredCameras} />


            {/* Map tiles */}
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />


            {/* Camera markers */}
            {filteredCameras.map((camera) => (
              <CircleMarker
                key={camera.id}
                center={camera.position}
                radius={10}
              >
                <Popup>
                  <strong>{camera.id}</strong>
                  <br />
                  Status: {camera.status}
                  <br />
                  Traffic: {camera.traffic}
                </Popup>
              </CircleMarker>
            ))}

          </MapContainer>

        </section>


        {/* ---------------- Filters ---------------- */}
        <aside className="filter-card">

          <h2>Filters</h2>


          {/* Time Range */}
          <label>Time Range</label>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option>Last 30 minutes</option>
            <option>Last 1 hour</option>
            <option>Last 6 hours</option>
            <option>Today</option>
          </select>


          {/* Camera Status */}
          <label>Camera Status</label>

          <select
            value={cameraStatus}
            onChange={(e) => setCameraStatus(e.target.value)}
          >
            <option>All Cameras</option>
            <option>Online</option>
            <option>Offline</option>
          </select>


          {/* Traffic Density */}
          <label>Traffic Density</label>

          <select
            value={trafficDensity}
            onChange={(e) => setTrafficDensity(e.target.value)}
          >
            <option>All</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>

        </aside>

      </main>


      {/* ---------------- Footer ---------------- */}
      <footer>
        Last refreshed: Just now
      </footer>

    </div>
  );
}

export default App;