'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Tenant } from '../types';

interface TenantContextValue {
  tenant: Tenant | null;
  tenantId: string;
  isLoading: boolean;
  isImpersonating: boolean;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  tenantId: 'inan',
  isLoading: true,
  isImpersonating: false,
});

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantId, setTenantId] = useState<string>('inan');
  const [isLoading, setIsLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/tenant/current');
        if (res.ok) {
          const data = await res.json();
          if (data.tenant) {
            setTenant(data.tenant);
            setTenantId(data.tenant.id ?? 'inan');
          } else {
            setTenantId(data.tenantId ?? 'inan');
          }
          setIsImpersonating(data.isImpersonating === true);
        }
      } catch {
        // Silently fall back to defaults
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, tenantId, isLoading, isImpersonating }}>
      {children}
    </TenantContext.Provider>
  );
}
