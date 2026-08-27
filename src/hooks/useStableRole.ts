/**
 * Custom hook to provide stable role information with fallback mechanisms
 * Addresses token refresh issues that can cause temporary role loss
 */

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { TenantRole } from '../types';

interface StableRoleState {
  role: TenantRole | null;
  tenantId: string | null;
  uid: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useStableRole(): StableRoleState {
  const [state, setState] = useState<StableRoleState>({
    role: null,
    tenantId: null,
    uid: null,
    isLoading: true,
    error: null,
  });

  const resolveRoleWithFallback = useCallback(async (user: User): Promise<{ role: TenantRole | null; tenantId: string | null }> => {
    try {
      // First attempt: Get from token claims
      let tokenResult = await user.getIdTokenResult(true);
      let claimRole = tokenResult.claims.role as TenantRole | undefined;
      let claimTenantId = tokenResult.claims.tenantId as string | undefined;

      // If claims are missing, retry with exponential backoff
      let retryCount = 0;
      const maxRetries = 3;
      
      while ((!claimRole || !claimTenantId) && retryCount < maxRetries) {
        const delay = 1000 * Math.pow(2, retryCount); // 1s, 2s, 4s
        console.log(`🔄 Role/tenant claims missing, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        tokenResult = await user.getIdTokenResult(true);
        claimRole = tokenResult.claims.role as TenantRole | undefined;
        claimTenantId = tokenResult.claims.tenantId as string | undefined;
        
        retryCount++;
      }

      // Final fallback: Read from Firestore if claims still missing
      if (!claimRole || !claimTenantId) {
        console.log('📋 Claims still missing after retries, falling back to Firestore...');
        
        const adminDoc = await getDoc(doc(db, 'tenant-admins', user.uid));
        if (adminDoc.exists()) {
          const adminData = adminDoc.data();
          claimRole = claimRole || (adminData.role as TenantRole);
          claimTenantId = claimTenantId || (adminData.tenantId as string);
          
          console.log('✅ Retrieved from Firestore:', { role: claimRole, tenantId: claimTenantId });
        } else {
          console.warn('⚠️ No tenant-admins document found for user:', user.uid);
        }
      }

      return {
        role: claimRole || null,
        tenantId: claimTenantId || null,
      };
      
    } catch (error) {
      console.error('❌ Error resolving role:', error);
      return { role: null, tenantId: null };
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({
          role: null,
          tenantId: null,
          uid: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      setState(prev => ({ ...prev, uid: user.uid, isLoading: true, error: null }));

      try {
        const { role, tenantId } = await resolveRoleWithFallback(user);
        
        setState({
          role,
          tenantId,
          uid: user.uid,
          isLoading: false,
          error: null,
        });
        
      } catch (error) {
        console.error('❌ Failed to resolve stable role:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to resolve role',
        }));
      }
    });

    return unsubscribe;
  }, [resolveRoleWithFallback]);

  return state;
}

/**
 * Helper hook for components that need role-based logic
 */
export function useRoleBasedVisibility() {
  const { role, isLoading } = useStableRole();
  
  return {
    isStaff: role === 'staff',
    isOwner: role === 'owner',
    isAdmin: role === 'owner', // Alias for owner (displayed as Admin in UI)
    role,
    isLoading,
    // Helper function for conditional rendering
    canSeeAllForms: role === 'owner',
    shouldFilterByCreator: role === 'staff',
  };
}