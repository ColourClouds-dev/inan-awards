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
  
  // Appearance settings
  appearance: {
    primaryColor: string;
    secondaryColor: string; 
    logoUrl: string;
    customCss: string;
  };
  
  // Response management
  responseManagement: {
    dataRetentionDays: number;
    autoArchiveAfterDays: number;
    responseLimit: number;
  };
  
  // Notification settings
  notifications: {
    emailNotifications: boolean;
    notificationEmail: string;
    alertThreshold: number;
    dailyDigest: boolean;
  };
  
  // Security settings
  security: {
    enableRecaptcha: boolean;
    allowedIpRanges: string[];
    requireVerification: boolean;
  };
  
  // Integration settings
  integrations: {
    apiKeys: Record<string, string>;
    webhookUrl: string;
    exportFormat: 'csv' | 'json' | 'excel';
  };
  
  // Default form values
  defaults: {
    defaultExpiryDays: number;
    footerText: string;
    disclaimer: string;
  };
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
    bannerImageUrl: '',
    appearance: {
      primaryColor: '',
      secondaryColor: '',
      logoUrl: '',
      customCss: ''
    },
    responseManagement: {
      dataRetentionDays: 0,
      autoArchiveAfterDays: 0,
      responseLimit: 0
    },
    notifications: {
      emailNotifications: false,
      notificationEmail: '',
      alertThreshold: 0,
      dailyDigest: false
    },
    security: {
      enableRecaptcha: false,
      allowedIpRanges: [],
      requireVerification: false
    },
    integrations: {
      apiKeys: {},
      webhookUrl: '',
      exportFormat: 'csv'
    },
    defaults: {
      defaultExpiryDays: 0,
      footerText: '',
      disclaimer: ''
    }
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
            bannerImageUrl: data.bannerImageUrl || '',
            appearance: {
              primaryColor: data.appearance?.primaryColor || '',
              secondaryColor: data.appearance?.secondaryColor || '',
              logoUrl: data.appearance?.logoUrl || '',
              customCss: data.appearance?.customCss || ''
            },
            responseManagement: {
              dataRetentionDays: data.responseManagement?.dataRetentionDays || 0,
              autoArchiveAfterDays: data.responseManagement?.autoArchiveAfterDays || 0,
              responseLimit: data.responseManagement?.responseLimit || 0
            },
            notifications: {
              emailNotifications: data.notifications?.emailNotifications || false,
              notificationEmail: data.notifications?.notificationEmail || '',
              alertThreshold: data.notifications?.alertThreshold || 0,
              dailyDigest: data.notifications?.dailyDigest || false
            },
            security: {
              enableRecaptcha: data.security?.enableRecaptcha || false,
              allowedIpRanges: data.security?.allowedIpRanges || [],
              requireVerification: data.security?.requireVerification || false
            },
            integrations: {
              apiKeys: data.integrations?.apiKeys || {},
              webhookUrl: data.integrations?.webhookUrl || '',
              exportFormat: data.integrations?.exportFormat || 'csv'
            },
            defaults: {
              defaultExpiryDays: data.defaults?.defaultExpiryDays || 0,
              footerText: data.defaults?.footerText || '',
              disclaimer: data.defaults?.disclaimer || ''
            }
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

      // Convert to Firestore compatible format
      const firestoreSettings = {
        ...updatedSettings,
        startDate: Timestamp.fromDate(settings.startDate),
        endDate: Timestamp.fromDate(settings.endDate),
        
        // Add all new sections
        appearance: updatedSettings.appearance,
        responseManagement: updatedSettings.responseManagement,
        notifications: updatedSettings.notifications,
        security: updatedSettings.security,
        integrations: updatedSettings.integrations,
        defaults: updatedSettings.defaults
      };

      await setDoc(doc(db, 'settings', 'survey'), firestoreSettings);

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
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
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
              <p className="text-sm font-medium text-red-800">{error}</p>
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
              <p className="text-sm font-medium text-green-800">{success}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <a href="#general" className="border-purple-500 text-purple-600 whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm">
              General
            </a>
            <a href="#appearance" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm">
              Appearance
            </a>
            <a href="#response" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm">
              Responses
            </a>
            <a href="#notifications" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm">
              Notifications
            </a>
            <a href="#security" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm">
              Security
            </a>
            <a href="#integrations" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm">
              Integrations
            </a>
            <a href="#defaults" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm">
              Defaults
            </a>
          </nav>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* General Settings */}
          <div id="general" className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">General Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <span className="ml-2 text-sm text-gray-700">System Active</span>
                </label>
              </div>
            </div>
          </div>

          {/* Appearance Settings */}
          <div id="appearance" className="space-y-6 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Appearance Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Input
                  type="text"
                  label="Primary Color"
                  placeholder="#6366F1"
                  value={settings.appearance.primaryColor}
                  onChange={(e) => setSettings({
                    ...settings,
                    appearance: {
                      ...settings.appearance,
                      primaryColor: e.target.value
                    }
                  })}
                />
              </div>

              <div>
                <Input
                  type="text"
                  label="Secondary Color"
                  placeholder="#8B5CF6"
                  value={settings.appearance.secondaryColor}
                  onChange={(e) => setSettings({
                    ...settings,
                    appearance: {
                      ...settings.appearance,
                      secondaryColor: e.target.value
                    }
                  })}
                />
              </div>

              <div>
                <Input
                  type="text"
                  label="Logo URL"
                  placeholder="https://example.com/logo.png"
                  value={settings.appearance.logoUrl}
                  onChange={(e) => setSettings({
                    ...settings,
                    appearance: {
                      ...settings.appearance,
                      logoUrl: e.target.value
                    }
                  })}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom CSS
                </label>
                <textarea
                  value={settings.appearance.customCss}
                  onChange={(e) => setSettings({
                    ...settings,
                    appearance: {
                      ...settings.appearance,
                      customCss: e.target.value
                    }
                  })}
                  rows={4}
                  className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder=".my-custom-class { color: #333; }"
                ></textarea>
                <p className="mt-1 text-sm text-gray-500">
                  Add custom CSS to customize the appearance of your forms
                </p>
              </div>
            </div>
          </div>

          {/* Response Management Settings */}
          <div id="response" className="space-y-6 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Response Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Input
                  type="number"
                  label="Data Retention (days)"
                  min="0"
                  value={settings.responseManagement.dataRetentionDays.toString()}
                  onChange={(e) => setSettings({
                    ...settings,
                    responseManagement: {
                      ...settings.responseManagement,
                      dataRetentionDays: parseInt(e.target.value) || 0
                    }
                  })}
                />
                <p className="mt-1 text-sm text-gray-500">
                  0 = keep indefinitely
                </p>
              </div>

              <div>
                <Input
                  type="number"
                  label="Auto-Archive After (days)"
                  min="0"
                  value={settings.responseManagement.autoArchiveAfterDays.toString()}
                  onChange={(e) => setSettings({
                    ...settings,
                    responseManagement: {
                      ...settings.responseManagement,
                      autoArchiveAfterDays: parseInt(e.target.value) || 0
                    }
                  })}
                />
                <p className="mt-1 text-sm text-gray-500">
                  0 = never auto-archive
                </p>
              </div>

              <div>
                <Input
                  type="number"
                  label="Response Limit per Form"
                  min="0"
                  value={settings.responseManagement.responseLimit.toString()}
                  onChange={(e) => setSettings({
                    ...settings,
                    responseManagement: {
                      ...settings.responseManagement,
                      responseLimit: parseInt(e.target.value) || 0
                    }
                  })}
                />
                <p className="mt-1 text-sm text-gray-500">
                  0 = unlimited responses
                </p>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div id="notifications" className="space-y-6 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Notification Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications.emailNotifications}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        emailNotifications: e.target.checked
                      }
                    })}
                    className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Email Notifications</span>
                </label>
              </div>

              <div>
                <Input
                  type="email"
                  label="Notification Email"
                  placeholder="admin@example.com"
                  value={settings.notifications.notificationEmail}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      notificationEmail: e.target.value
                    }
                  })}
                />
              </div>

              <div>
                <Input
                  type="number"
                  label="Alert Threshold"
                  min="0"
                  value={settings.notifications.alertThreshold.toString()}
                  onChange={(e) => setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      alertThreshold: parseInt(e.target.value) || 0
                    }
                  })}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Get notified after this many responses (0 = notify for each response)
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.notifications.dailyDigest}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        dailyDigest: e.target.checked
                      }
                    })}
                    className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Daily Digest</span>
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  Receive a daily summary of all responses
                </p>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div id="security" className="space-y-6 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Security Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.security.enableRecaptcha}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: {
                        ...settings.security,
                        enableRecaptcha: e.target.checked
                      }
                    })}
                    className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable reCAPTCHA</span>
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  Protect your forms from spam and abuse
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.security.requireVerification}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: {
                        ...settings.security,
                        requireVerification: e.target.checked
                      }
                    })}
                    className="rounded border-gray-300 text-purple-600 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Require Verification</span>
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  Verify respondents via email before accepting responses
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allowed IP Ranges
                </label>
                <textarea
                  value={settings.security.allowedIpRanges.join('\n')}
                  onChange={(e) => setSettings({
                    ...settings,
                    security: {
                      ...settings.security,
                      allowedIpRanges: e.target.value.split('\n').filter(Boolean)
                    }
                  })}
                  rows={3}
                  className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="192.168.1.0/24&#10;10.0.0.0/8"
                ></textarea>
                <p className="mt-1 text-sm text-gray-500">
                  Enter IP ranges or addresses (one per line) to restrict access. Leave empty to allow all.
                </p>
              </div>
            </div>
          </div>

          {/* Integration Settings */}
          <div id="integrations" className="space-y-6 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Integration Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Input
                  type="text"
                  label="Webhook URL"
                  placeholder="https://example.com/webhook"
                  value={settings.integrations.webhookUrl}
                  onChange={(e) => setSettings({
                    ...settings,
                    integrations: {
                      ...settings.integrations,
                      webhookUrl: e.target.value
                    }
                  })}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Receive notifications when forms are submitted
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Export Format
                </label>
                <select
                  value={settings.integrations.exportFormat}
                  onChange={(e) => setSettings({
                    ...settings,
                    integrations: {
                      ...settings.integrations,
                      exportFormat: e.target.value as 'csv' | 'json' | 'excel'
                    }
                  })}
                  className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-300 rounded-md"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="excel">Excel</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Default format for exporting form responses
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Keys
                </label>
                <div className="space-y-2">
                  {Object.entries(settings.integrations.apiKeys).map(([service, key], index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        type="text"
                        placeholder="Service name"
                        value={service}
                        onChange={(e) => {
                          const updatedKeys = { ...settings.integrations.apiKeys };
                          delete updatedKeys[service];
                          updatedKeys[e.target.value] = key;
                          setSettings({
                            ...settings,
                            integrations: {
                              ...settings.integrations,
                              apiKeys: updatedKeys
                            }
                          });
                        }}
                      />
                      <Input
                        type="text"
                        placeholder="API key"
                        value={key}
                        onChange={(e) => {
                          const updatedKeys = { ...settings.integrations.apiKeys };
                          updatedKeys[service] = e.target.value;
                          setSettings({
                            ...settings,
                            integrations: {
                              ...settings.integrations,
                              apiKeys: updatedKeys
                            }
                          });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updatedKeys = { ...settings.integrations.apiKeys };
                          delete updatedKeys[service];
                          setSettings({
                            ...settings,
                            integrations: {
                              ...settings.integrations,
                              apiKeys: updatedKeys
                            }
                          });
                        }}
                        className="p-2 text-red-600 hover:text-red-800"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const updatedKeys = { ...settings.integrations.apiKeys };
                      updatedKeys[`service-${Object.keys(updatedKeys).length + 1}`] = '';
                      setSettings({
                        ...settings,
                        integrations: {
                          ...settings.integrations,
                          apiKeys: updatedKeys
                        }
                      });
                    }}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    Add API Key
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Default Values */}
          <div id="defaults" className="space-y-6 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Default Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Input
                  type="number"
                  label="Default Expiry (days)"
                  min="0"
                  value={settings.defaults.defaultExpiryDays.toString()}
                  onChange={(e) => setSettings({
                    ...settings,
                    defaults: {
                      ...settings.defaults,
                      defaultExpiryDays: parseInt(e.target.value) || 0
                    }
                  })}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Default expiry time for new forms (0 = never expire)
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Footer Text
                </label>
                <textarea
                  value={settings.defaults.footerText}
                  onChange={(e) => setSettings({
                    ...settings,
                    defaults: {
                      ...settings.defaults,
                      footerText: e.target.value
                    }
                  })}
                  rows={2}
                  className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="© 2023 Your Company. All rights reserved."
                ></textarea>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Disclaimer
                </label>
                <textarea
                  value={settings.defaults.disclaimer}
                  onChange={(e) => setSettings({
                    ...settings,
                    defaults: {
                      ...settings.defaults,
                      disclaimer: e.target.value
                    }
                  })}
                  rows={3}
                  className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="By submitting this form, you agree to our terms and conditions..."
                ></textarea>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6">
            <Button
              type="submit"
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
