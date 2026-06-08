'use client';

import { useEffect, useState } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  /** True while the "back online" confirmation is briefly showing */
  justReconnected: boolean;
}

const RECONNECT_DISPLAY_MS = 2500;

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    // Initialise from browser state — navigator.onLine is synchronous
    setIsOnline(navigator.onLine);

    let reconnectTimer: ReturnType<typeof setTimeout>;

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      reconnectTimer = setTimeout(() => setJustReconnected(false), RECONNECT_DISPLAY_MS);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
      clearTimeout(reconnectTimer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(reconnectTimer);
    };
  }, []);

  return { isOnline, justReconnected };
}
