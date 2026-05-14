'use client';

import { useEffect } from 'react';
import { useTenant } from '../contexts/TenantContext';

/**
 * Reads the tenant's brand color from TenantContext and injects it as a
 * CSS custom property (--brand) on <html>. This makes the color available
 * to all .btn-brand / .text-brand / .border-brand utility classes.
 */
export default function BrandProvider() {
  const { tenant } = useTenant();

  useEffect(() => {
    const color = tenant?.branding?.primaryColor;
    if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
      document.documentElement.style.setProperty('--brand', color);
    } else {
      // Reset to default Inan purple when no branding is set
      document.documentElement.style.setProperty('--brand', '#7C3AED');
    }
  }, [tenant?.branding?.primaryColor]);

  return null;
}
