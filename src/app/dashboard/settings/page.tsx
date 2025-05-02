'use client';

import React, { useEffect, useState } from 'react';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { db, storage, auth } from '../../../lib/firebase';
import type { SurveySettings } from '../../../types';
import Button from '../../../components/Button';
import Input from '../../../components/Input';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface DashboardSettings {
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  bannerImageUrl?: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState<DashboardSettings>({
    startDate: new Date(),
    endDate: new Date(),
    isActive: false,
    bannerImageUrl: ''
  });
  const [bannerImage, setBannerImage] = useState<File | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'survey'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as SurveySettings;
          const startDate = data.startDate instanceof Timestamp 
            ? data.startDate.toDate() 
            : new Date(data.startDate);
          const endDate = data.endDate instanceof Timestamp 
            ? data.endDate.toDate() 
            : new Date(data.endDate);

          setSettings({
            ...data,
            startDate,
            endDate,
            bannerImageUrl: data.bannerImageUrl || ''
          });
        }
      } catch (err) {
        console.error('Error loading settings:', err);
        setError('Failed to load settings. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const validateDates = (startDate: Date, endDate: Date): string | null => {
    if (startDate >= endDate) {
      return 'Start date must be before end date';
    }
    if (startDate < new Date(Date.now() - 86400000)) { // Don't allow dates more than 1 day in the past
      return 'Start date cannot be in the past';
    }
    return null;
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload a JPEG, PNG, or WebP image.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size too large. Maximum size is 5MB.';
    }
    return null;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      setError(error);
      return;
    }

    setBannerImage(file);
    setError('');
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    const fileName = `banner-${Date.now()}-${file.name}`;
    const storageRef = ref(storage, `banners/${fileName}`);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const deleteOldBanner = async (url: string) => {
    try {
      const oldBannerRef = ref(storage, url);
      await deleteObject(oldBannerRef);
    } catch (error) {
      console.error('Error deleting old banner:', error);
      // Don't throw error as this is not critical
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate dates
    const dateError = validateDates(settings.startDate, settings.endDate);
    if (dateError) {
      setError(dateError);
      return;
    }

    setSaving(true);

    try {
      let updatedSettings = { ...settings };

      if (bannerImage) {
        // Delete old banner if it exists
        if (settings.bannerImageUrl) {
          await deleteOldBanner(settings.bannerImageUrl);
        }
        const imageUrl = await handleImageUpload(bannerImage);
        updatedSettings.bannerImageUrl = imageUrl;
      }

      await setDoc(doc(db, 'settings', 'survey'), {
        ...updatedSettings,
        startDate: Timestamp.fromDate(settings.startDate),
        endDate: Timestamp.fromDate(settings.endDate)
      });

      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setBannerImage(null);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings. Please try again later.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Survey Settings</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 gap-6">
          <div>
            <Input
              type="datetime-local"
              label="Start Date"
              value={settings.startDate.toISOString().slice(0, 16)}
              onChange={(e) => setSettings({
                ...settings,
                startDate: new Date(e.target.value)
              })}
            />
          </div>

          <div>
            <Input
              type="datetime-local"
              label="End Date"
              value={settings.endDate.toISOString().slice(0, 16)}
              onChange={(e) => setSettings({
                ...settings,
                endDate: new Date(e.target.value)
              })}
            />
          </div>

          <div>
            <Input
              type="file"
              label="Banner Image"
              accept={ALLOWED_FILE_TYPES.join(',')}
              onChange={handleImageChange}
            />
            <p className="mt-1 text-sm text-gray-500">
              Maximum file size: 5MB. Allowed formats: JPEG, PNG, WebP
            </p>
            {settings.bannerImageUrl && (
              <div className="mt-2">
                <img
                  src={settings.bannerImageUrl}
                  alt="Current banner"
                  className="h-32 object-cover rounded-md"
                />
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.isActive}
                onChange={(e) => setSettings({
                  ...settings,
                  isActive: e.target.checked
                })}
                className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-500 focus:ring-purple-500"
              />
              <span className="ml-2 text-sm text-gray-700">Survey Active</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">{success}</h3>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            isLoading={saving}
          >
            Save Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
