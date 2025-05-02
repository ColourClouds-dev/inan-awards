'use client';

import React, { useEffect, useState } from 'react';

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [showFullScreen, setShowFullScreen] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    // Add event listeners for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      setShowFullScreen(false);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      // If offline for more than 5 seconds, show full screen message
      setTimeout(() => {
        if (!navigator.onLine) {
          setShowFullScreen(true);
        }
      }, 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set up periodic connection check
    const checkConnection = setInterval(() => {
      if (!navigator.onLine) {
        setRetryCount(prev => prev + 1);
        // Try to reconnect
        fetch('/api/ping', { method: 'HEAD', cache: 'no-store' })
          .then(() => {
            setIsOnline(true);
            setShowFullScreen(false);
          })
          .catch(() => {
            setIsOnline(false);
          });
      } else {
        setRetryCount(0);
      }
    }, 10000);

    // Clean up event listeners and interval
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(checkConnection);
    };
  }, []);

  if (isOnline) return null;

  if (showFullScreen) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6">
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-8 max-w-md text-center shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-yellow-500 mb-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <h2 className="text-2xl font-bold text-yellow-800 mb-4">You're Offline</h2>
          <p className="text-yellow-700 mb-6">
            Your device is not connected to the internet. The app will continue to work with limited functionality.
          </p>
          <p className="text-sm text-yellow-600 mb-4">
            Connection attempts: {retryCount} <br />
            Waiting for connection...
          </p>
          <div className="animate-pulse w-full h-2 bg-yellow-200 rounded-full overflow-hidden">
            <div className="bg-yellow-400 h-full w-1/3 rounded-full"></div>
          </div>
          <button 
            onClick={() => setShowFullScreen(false)} 
            className="mt-6 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md"
          >
            Continue in Limited Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md shadow-md flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <span>You're offline. Some features may be limited.</span>
    </div>
  );
};

export default OfflineIndicator; 