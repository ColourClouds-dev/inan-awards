'use client';

import React from 'react';
import PollBuilder from '../../../../../components/PollBuilder';
import { useTenant } from '../../../../../contexts/TenantContext';

export default function CreatePollPage() {
  const { isLoading: tenantLoading } = useTenant();

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" role="status" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      <PollBuilder />
    </div>
  );
}
