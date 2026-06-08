'use client';

import React, { useEffect, useState } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * Floating network-status pill.
 *
 * Behaviour:
 *  - Hidden while online and not recently reconnected
 *  - Slides down from top-center when offline (red/amber pill)
 *  - Switches to green "Back online" for 2.5s when reconnected
 *  - Then slides back up and disappears completely
 *
 * Mount once in the root layout — it handles its own visibility.
 */
export default function OfflineBanner() {
  const { isOnline, justReconnected } = useNetworkStatus();

  // `visible` controls whether the pill is in the DOM / painted
  // `show` controls the CSS translate (drives the slide animation)
  const [show, setShow] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      // Mount immediately, then trigger slide-down on next frame
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
    } else if (justReconnected) {
      // Keep visible (already mounted), switch to green
      setShow(true);
    } else {
      // Online and reconnect display window has passed — slide up then unmount
      setShow(false);
      const t = setTimeout(() => setVisible(false), 400); // matches transition duration
      return () => clearTimeout(t);
    }
  }, [isOnline, justReconnected]);

  if (!visible) return null;

  const isReconnecting = isOnline && justReconnected;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isReconnecting ? 'Back online' : 'No internet connection'}
      className={[
        // Positioning — fixed, centered at top, above everything
        'fixed top-4 left-1/2 z-[9999]',
        // Pill shape
        'flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl',
        'text-sm font-medium whitespace-nowrap',
        // Slide animation via translate
        'transition-all duration-400 ease-in-out',
        '-translate-x-1/2',                                      // always centred horizontally
        show ? 'translate-y-0 opacity-100' : '-translate-y-16 opacity-0',
        // Colour
        isReconnecting
          ? 'bg-green-500 text-white'
          : 'bg-gray-700 text-white',
      ].join(' ')}
    >
      {isReconnecting ? (
        <>
          {/* Animated checkmark */}
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white/20">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          Back online
        </>
      ) : (
        <>
          {/* Pulsing dot */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          No internet connection
        </>
      )}
    </div>
  );
}
