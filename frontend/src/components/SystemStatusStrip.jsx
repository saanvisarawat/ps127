import { useHealthCheck } from '../api/hooks';
import { useAlertSocketContext } from '../api/AlertSocketContext';

export default function SystemStatusStrip() {
  const health = useHealthCheck();
  const { connectionStatus } = useAlertSocketContext();

  const lastSync = health.dataUpdatedAt ? new Date(health.dataUpdatedAt).toLocaleTimeString() : '—';
  const dbLabel = health.isError ? 'DISCONNECTED' : health.isSuccess ? 'CONNECTED' : 'CHECKING…';
  const dbOk = health.isSuccess;

  return (
    <div className="system-status-strip mono">
      <span className={`status-chip${dbOk ? ' good' : health.isError ? ' bad' : ''}`}>
        <span className="status-chip-dot" /> DB {dbLabel}
      </span>
      <span className={`status-chip${connectionStatus === 'connected' ? ' good' : ' bad'}`}>
        <span className="status-chip-dot" /> WS {connectionStatus.toUpperCase()}
      </span>
      <span className="status-chip status-chip-muted">Last sync {lastSync}</span>
    </div>
  );
}
