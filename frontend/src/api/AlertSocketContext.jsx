import { createContext, useContext } from 'react';
import { useAlertSocket } from './useAlertSocket';

const AlertSocketContext = createContext(null);

export function AlertSocketProvider({ children }) {
  const value = useAlertSocket(50);
  return <AlertSocketContext.Provider value={value}>{children}</AlertSocketContext.Provider>;
}

export function useAlertSocketContext() {
  const ctx = useContext(AlertSocketContext);
  if (!ctx) throw new Error('useAlertSocketContext must be used within AlertSocketProvider');
  return ctx;
}
