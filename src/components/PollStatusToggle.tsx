'use client';

import React, { useState } from 'react';
import { updatePoll } from '../lib/pollsFirestore';

interface PollStatusToggleProps {
  pollId: string;
  initialStatus: boolean;
  onToggle?: (newStatus: boolean) => void;
}

export default function PollStatusToggle({
  pollId,
  initialStatus,
  onToggle,
}: PollStatusToggleProps) {
  const [isActive, setIsActive] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    const newStatus = !isActive;
    try {
      await updatePoll(pollId, { isActive: newStatus });
      setIsActive(newStatus);
      if (onToggle) onToggle(newStatus);
    } catch (err) {
      console.error('Failed to toggle poll status:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-55 ${isActive ? 'bg-green-500' : 'bg-gray-200'}`}
      title={isActive ? 'Deactivate Poll' : 'Activate Poll'}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}
