'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { Tenant, TenantRole } from '../types';

interface TenantContextValue {
  tenant: Tenant | null;
  tenantId: string;
  isLoading: boolean;
  isImpersonating: boolean;
  role: TenantRole | null;
  /** True when role === 'owner'. Kept for backward compat — prefer isAdmin in new code. */
  isOwner: boolean;
  /** Alias for isOwner. The "owner" data-layer role is displayed as "Admin" in the UI. */
  isAdmin: boolean;
  isStaff: boolean;
  currentUid: string | null;
  /** Human-readable label for the current user's role. */
  roleLabel: string;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  tenantId: 'inan',
  isLoading: true,
  isImpersonating: false,
  role: null,
  isOwner: false,
  isAdmin: false,
  isStaff: false,
  currentUid: null,
  roleLabel: '—',
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
  const [role, setRole] = useState<TenantRole | null>(null);
  const [currentUid, setCurrentUid] = useState<string | null>(null);

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

        // Not impersonating — resolve tenant + role from the logged-in user's auth token claim.
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          try {
            if (user) {
              setCurrentUid(user.uid);
              const tokenResult = await user.getIdTokenResult(true);
              const claimTenantId = tokenResult.claims.tenantId as string | undefined;
              const claimRole = tokenResult.claims.role as TenantRole | undefined;

              if (claimRole) setRole(claimRole);

              if (claimTenantId) {
                const tenantSnap = await getDoc(doc(db, 'tenants', claimTenantId));
                if (tenantSnap.exists()) {
                  setTenant({ id: tenantSnap.id, ...tenantSnap.data() } as Tenant);
                  setTenantId(claimTenantId);
                } else {
                  setTenantId(claimTenantId);
                }

                // If role wasn't in the claim, fall back to reading tenant-admins doc
                if (!claimRole) {
                  try {
                    const adminSnap = await getDoc(doc(db, 'tenant-admins', user.uid));
                    if (adminSnap.exists()) {
                      const r = adminSnap.data().role as TenantRole | undefined;
                      if (r) setRole(r);
                    }
                  } catch { /* non-fatal */ }
                }
              } else {
                // No claim — fall back to domain-based resolution
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
              setCurrentUid(null);
              setRole(null);
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

  // "owner" in Firestore/claims is the organisation admin — displayed as "Admin" in the UI.
  const isOwner = role === 'owner';
  const isAdmin = isOwner;
  const isStaff = role === 'staff';
  const roleLabel = isOwner ? 'Admin' : isStaff ? 'Staff' : '—';

  return (
    <TenantContext.Provider value={{
      tenant, tenantId, isLoading, isImpersonating,
      role, isOwner, isAdmin, isStaff, currentUid, roleLabel,
    }}>
      {children}
    </TenantContext.Provider>
  );
}
