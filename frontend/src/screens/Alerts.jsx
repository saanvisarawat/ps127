import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useAlerts,
  useAlertAction,
  useBlacklist,
  useAddBlacklist,
  useRemoveBlacklist,
  useCameras,
} from '../api/hooks';
import { useAlertSocketContext } from '../api/AlertSocketContext';
import { SkeletonBlock } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StatePanel';
import { downloadCsv } from '../utils/csv';

const SEVERITIES = ['All', 'HIGH', 'MEDIUM', 'LOW'];
const TYPES = ['All', 'BLACKLIST_MATCH', 'CURFEW_VIOLATION', 'ROUTE_CIRCLING'];

function normalizeAlert(raw) {
  return {
    id: raw.id,
    plate_text: raw.plate_text ?? raw.plate,
    camera_id: raw.camera_id ?? raw.camera,
    type: raw.type,
    confidence: raw.confidence,
    severity: raw.severity || 'MEDIUM',
    status: raw.status || 'NEW',
    acknowledged: !!raw.acknowledged,
    explanation: raw.explanation,
    ts: raw.ts,
  };
}

function AlertCard({ alert, onAction, isPending }) {
  const isHigh = alert.severity === 'HIGH';
  return (
    <div className={`glass-card alert-card${isHigh ? ' severity-high' : ' severity-medium'}`}>
      <div className="alert-card-top">
        <Link to={`/trajectory?plate=${encodeURIComponent(alert.plate_text)}`} className="alert-plate mono alert-plate-link">
          {alert.plate_text}
        </Link>
        <span className={`alert-severity-badge${isHigh ? ' high' : ''}`}>{alert.severity}</span>
      </div>
      <div className="alert-meta mono">
        <span>{alert.camera_id}</span>
        <span>·</span>
        <span>{new Date(alert.ts).toLocaleString()}</span>
        <span>·</span>
        <span>{alert.type}</span>
      </div>
      {alert.explanation?.details && <p className="alert-explanation">{alert.explanation.details}</p>}
      <div className="alert-footer">
        <span className={`alert-status-pill status-${alert.status.toLowerCase()}`}>{alert.status}</span>
        <div className="alert-actions">
          <button
            className="btn btn-sm btn-ghost"
            disabled={isPending || alert.status === 'ACKNOWLEDGED'}
            onClick={() => onAction(alert.id, 'acknowledge')}
          >
            Acknowledge
          </button>
          <button
            className="btn btn-sm btn-ghost"
            disabled={isPending || alert.status === 'ESCALATED'}
            onClick={() => onAction(alert.id, 'escalate')}
          >
            Escalate
          </button>
          <button
            className="btn btn-sm btn-danger"
            disabled={isPending || alert.status === 'DISMISSED'}
            onClick={() => onAction(alert.id, 'dismiss')}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function CameraHealthStrip() {
  const camerasQuery = useCameras();

  if (camerasQuery.isLoading) return <SkeletonBlock height={56} />;
  if (camerasQuery.isError) {
    return <ErrorState message="Could not load camera health" onRetry={() => camerasQuery.refetch()} />;
  }
  if (!camerasQuery.data?.length) {
    return <EmptyState title="No cameras registered" />;
  }

  return (
    <div className="camera-health-strip">
      {camerasQuery.data.map((cam) => (
        <div key={cam.id} className={`camera-chip${cam.status === 'Online' ? ' online' : ''}`}>
          <span className="camera-status-dot" style={{ background: cam.status === 'Online' ? 'var(--accent)' : 'var(--text-faint)' }} />
          <span className="mono">{cam.id}</span>
          <span className="camera-chip-reads mono">{cam.recent_reads} reads/15m</span>
        </div>
      ))}
    </div>
  );
}

function BlacklistManager() {
  const blacklistQuery = useBlacklist();
  const addMutation = useAddBlacklist();
  const removeMutation = useRemoveBlacklist();

  const [plate, setPlate] = useState('');
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('HIGH');

  function handleAdd(e) {
    e.preventDefault();
    if (!plate.trim() || !reason.trim()) return;
    addMutation.mutate(
      { plate_text: plate.trim().toUpperCase(), reason: reason.trim(), severity },
      { onSuccess: () => { setPlate(''); setReason(''); } }
    );
  }

  return (
    <div className="glass-card filter-card">
      <h2>Blacklist Manager</h2>

      <form onSubmit={handleAdd} className="blacklist-form">
        <input
          type="text"
          className="mono"
          placeholder="Plate number"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
        />
        <input
          type="text"
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option>HIGH</option>
          <option>MEDIUM</option>
          <option>LOW</option>
        </select>
        <button className="btn btn-sm" type="submit" disabled={addMutation.isPending}>
          Add
        </button>
      </form>

      {blacklistQuery.isLoading && <SkeletonBlock height={80} />}
      {blacklistQuery.isError && (
        <ErrorState message="Could not load blacklist" onRetry={() => blacklistQuery.refetch()} />
      )}
      {blacklistQuery.data && blacklistQuery.data.length === 0 && (
        <EmptyState title="Blacklist is empty" message="Add a plate above to start flagging it in real time." />
      )}

      {blacklistQuery.data && blacklistQuery.data.length > 0 && (
        <ul className="blacklist-list">
          {blacklistQuery.data.map((entry) => (
            <li key={entry.plate_text} className="blacklist-row">
              <div>
                <div className="mono">{entry.plate_text}</div>
                <div className="blacklist-reason">{entry.reason}</div>
              </div>
              <div className="blacklist-row-actions">
                <span className={`alert-severity-badge${entry.severity === 'HIGH' ? ' high' : ''}`}>
                  {entry.severity}
                </span>
                <button
                  className="btn btn-sm btn-danger"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(entry.plate_text)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Alerts() {
  const [unacknowledgedOnly, setUnacknowledgedOnly] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  const restQuery = useAlerts(unacknowledgedOnly);
  const { liveAlerts, connectionStatus } = useAlertSocketContext();
  const actionMutation = useAlertAction();

  const mergedAlerts = useMemo(() => {
    const map = new Map();
    (restQuery.data || []).forEach((a) => map.set(a.id, normalizeAlert(a)));
    liveAlerts.forEach((a) => map.set(a.id, normalizeAlert(a)));
    return Array.from(map.values())
      .filter((a) => !unacknowledgedOnly || !a.acknowledged)
      .filter((a) => severityFilter === 'All' || a.severity === severityFilter)
      .filter((a) => typeFilter === 'All' || a.type === typeFilter)
      .sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }, [restQuery.data, liveAlerts, unacknowledgedOnly, severityFilter, typeFilter]);

  function handleAction(id, action) {
    actionMutation.mutate({ id, action });
  }

  function handleExportCsv() {
    downloadCsv(
      'alerts-export.csv',
      mergedAlerts.map((a) => ({
        id: a.id,
        plate_text: a.plate_text,
        camera_id: a.camera_id,
        type: a.type,
        severity: a.severity,
        status: a.status,
        confidence: a.confidence,
        ts: a.ts,
        details: a.explanation?.details || '',
      }))
    );
  }

  const showOffline = connectionStatus !== 'connected' && !restQuery.isLoading && mergedAlerts.length === 0;

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Alerts & Live Monitoring</h1>
          <p>
            Real-time feed over <span className="mono">/ws/alerts</span> — {connectionStatus}
          </p>
        </div>
        <label className="alert-toggle mono">
          <input
            type="checkbox"
            checked={unacknowledgedOnly}
            onChange={(e) => setUnacknowledgedOnly(e.target.checked)}
          />
          Unacknowledged only
        </label>
      </header>

      <section className="glass-card map-card" style={{ marginBottom: 18 }}>
        <div className="section-heading">
          <div>
            <h2>Camera Health</h2>
          </div>
        </div>
        <CameraHealthStrip />
      </section>

      <main className="main-grid">
        <section>
          <div className="glass-card filter-card alerts-filter-row" style={{ marginBottom: 14 }}>
            <div>
              <label className="field-label" style={{ marginTop: 0 }}>
                Severity
              </label>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                {SEVERITIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" style={{ marginTop: 0 }}>
                Type
              </label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={handleExportCsv} disabled={mergedAlerts.length === 0}>
              ⭳ Export CSV
            </button>
          </div>

          {restQuery.isLoading && <SkeletonBlock height={300} />}
          {restQuery.isError && (
            <div className="glass-card map-card">
              <ErrorState message="Could not load alert history" onRetry={() => restQuery.refetch()} />
            </div>
          )}

          {!restQuery.isLoading && !restQuery.isError && mergedAlerts.length === 0 && (
            <div className="glass-card map-card">
              {showOffline ? (
                <EmptyState
                  variant="offline"
                  title="Live feed disconnected"
                  message="The alert socket is down, so this list may be stale. Reconnecting automatically…"
                />
              ) : (
                <EmptyState
                  variant="success"
                  title="No alerts to show"
                  message={unacknowledgedOnly ? 'All caught up — nothing unacknowledged right now.' : 'No alerts match the current filters.'}
                />
              )}
            </div>
          )}

          <div className="alert-feed">
            {mergedAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onAction={handleAction} isPending={actionMutation.isPending} />
            ))}
          </div>
        </section>

        <BlacklistManager />
      </main>
    </div>
  );
}
