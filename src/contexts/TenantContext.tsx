'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
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
        // First check if super admin is impersonating via the API
        const res = await fetch('/api/tenant/current');
        if (res.ok) {
          const data = await res.json();

          // If impersonating, always use the impersonated tenant
          if (data.isImpersonating && data.tenant) {
            setTenant(data.tenant);
            setTenantId(data.tenant.id);
            setIsImpersonating(true);
            setIsLoading(false);
            return;
          }
        }

        // Not impersonating — resolve tenant from the logged-in user's auth token claim.
        // This is the correct source of truth: the custom claim set at registration
        // tells us exactly which tenant this user belongs to, regardless of domain.
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          try {
            if (user) {
              const tokenResult = await user.getIdTokenResult();
              const claimTenantId = tokenResult.claims.tenantId as string | undefined;

              if (claimTenantId) {
                // Load the full tenant document using the claim
                const tenantSnap = await getDoc(doc(db, 'tenants', claimTenantId));
                if (tenantSnap.exists()) {
                  setTenant({ id: tenantSnap.id, ...tenantSnap.data() } as Tenant);
                  setTenantId(claimTenantId);
                } else {
                  setTenantId(claimTenantId);
                }
              } else {
                // No claim — fall back to domain-based resolution from the API
                const fallbackRes = await fetch('/api/tenant/current');
                if (fallbackRes.ok) {
                  const data = await fallbackRes.json();
                  if (data.tenant) {
                    setTenant(data.tenant);
                    setTenantId(data.tenant.id ?? 'inan');
                  } else {
                    setTenantId(data.tenantId ?? 'inan');
                  }
                }
              }
            } else {
              // Not logged in — use domain-based resolution (for public pages)
              const fallbackRes = await fetch('/api/tenant/current');
              if (fallbackRes.ok) {
                const data = await fallbackRes.json();
                if (data.tenant) {
                  setTenant(data.tenant);
                  setTenantId(data.tenant.id ?? 'inan');
                } else {
                  setTenantId(data.tenantId ?? 'inan');
                }
              }
            }
          } catch {
            // Silently fall back
          } finally {
            setIsLoading(false);
          }
          unsubscribe();
        });
      } catch {
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
