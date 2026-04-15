'use client';

import React, { useRef, useState } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';

interface ImageUploadProps {
  label: string;
  hint?: string;
  currentUrl?: string;
  storagePath: string; // e.g. 'seo/og-image' or 'forms/abc123/og-image'
  onUploaded: (url: string) => void;
  onRemoved?: () => void;
}

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ImageUpload: React.FC<ImageUploadProps> = ({
  label,
  hint,
  currentUrl,
  storagePath,
  onUploaded,
  onRemoved,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | undefined>(currentUrl);

  const handleFile = async (file: File) => {
    setError('');
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('File must be under 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `${storagePath}-${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPreview(url);
      onUploaded(url);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!preview) return;
    try {
      const storageRef = ref(storage, preview);
      await deleteObject(storageRef);
    } catch {
      // File may not exist in storage (e.g. external URL) — ignore
    }
    setPreview(undefined);
    onRemoved?.();
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label className="block text-lg font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}

      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="OG preview"
            className="h-32 w-auto rounded-lg border border-gray-200 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
            title="Remove image"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
          ) : (
            <>
              <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-gray-500">Click to upload (JPEG, PNG, WebP · max 5 MB)</p>
              <p className="text-xs text-gray-400 mt-0.5">Recommended: 1200 × 630 px</p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default ImageUpload;
