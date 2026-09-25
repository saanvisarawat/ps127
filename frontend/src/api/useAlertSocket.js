import { useEffect, useRef, useState } from 'react';
import { WS_BASE } from './client';

// Connects to /ws/alerts and keeps a rolling in-memory list of live-pushed alerts,
// separate from the REST history so the feed updates instantly without a refetch.
export function useAlertSocket(maxItems = 50) {
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const socketRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer;

    function connect() {
      const socket = new WebSocket(`${WS_BASE}/ws/alerts`);
      socketRef.current = socket;

      socket.onopen = () => !cancelled && setConnectionStatus('connected');
      socket.onclose = () => {
        if (cancelled) return;
        setConnectionStatus('disconnected');
        retryTimer = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'SYSTEM_CONNECTED') return;
        setLiveAlerts((prev) => [{ ...data, receivedAt: Date.now() }, ...prev].slice(0, maxItems));
      };
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      socketRef.current?.close();
    };
  }, [maxItems]);

  return { liveAlerts, connectionStatus };
}
