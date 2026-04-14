'use client';

import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  onConfirm?: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  children,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const confirmStyles =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-purple-600 hover:bg-purple-700 text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Panel */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
        {variant === 'danger' && (
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        )}

        <h2 id="modal-title" className="text-lg font-semibold text-gray-900 text-center">
          {title}
        </h2>
        {message && <p className="text-sm text-gray-600 text-center">{message}</p>}
        {children}

        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            {cancelLabel}
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${confirmStyles}`}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
