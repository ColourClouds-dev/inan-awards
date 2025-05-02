'use client';

import React, { useEffect } from 'react';

/**
 * Component to handle cleanup of problematic attributes that cause hydration errors
 */
const CustomDocument: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Fix for cz-shortcut-listen attribute issue
    const body = document.querySelector('body');
    if (body && body.hasAttribute('cz-shortcut-listen')) {
      body.removeAttribute('cz-shortcut-listen');
    }
    
    // Handle any other attributes that might cause hydration errors
    const elementsWithData = document.querySelectorAll('[data-reactroot]');
    elementsWithData.forEach(el => {
      el.removeAttribute('data-reactroot');
    });
  }, []);

  return <>{children}</>;
};

export default CustomDocument; 