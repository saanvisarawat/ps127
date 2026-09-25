import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlertSocketContext } from '../api/AlertSocketContext';

const TOAST_LIFETIME_MS = 6000;

export default function ToastContainer() {
  const { liveAlerts } = useAlertSocketContext();
  const [toasts, setToasts] = useState([]);
  const lastSeenId = useRef(null);

  useEffect(() => {
    const newest = liveAlerts[0];
    if (!newest || newest.id === lastSeenId.current) return;
    lastSeenId.current = newest.id;

    const toast = {
      key: `${newest.id}-${newest.receivedAt}`,
      id: newest.id,
      plate: newest.plate,
      type: newest.type,
      severity: newest.severity,
    };
    setToasts((prev) => [toast, ...prev].slice(0, 4));

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.key !== toast.key));
    }, TOAST_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [liveAlerts]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <Link
          to={`/trajectory?plate=${encodeURIComponent(toast.plate)}`}
          key={toast.key}
          className={`toast${toast.severity === 'HIGH' ? ' toast-high' : ''}`}
          onClick={() => setToasts((prev) => prev.filter((t) => t.key !== toast.key))}
        >
          <span className="toast-dot" />
          <div>
            <div className="toast-title mono">{toast.type}</div>
            <div className="toast-plate mono">{toast.plate}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
