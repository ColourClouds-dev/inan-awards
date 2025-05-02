import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SurveySettings } from '../types';

const CountdownTimer = () => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [settings, setSettings] = useState<SurveySettings | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'survey'), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as SurveySettings;
        setSettings({
          ...data,
          startDate: data.startDate instanceof Date ? data.startDate : data.startDate.toDate(),
          endDate: data.endDate instanceof Date ? data.endDate : data.endDate.toDate()
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!settings) return;

    const getDateValue = (value: Date | Timestamp): Date => {
      return value instanceof Date ? value : value.toDate();
    };

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = getDateValue(settings.endDate).getTime();
      const start = getDateValue(settings.startDate).getTime();

      if (now < start) {
        const distance = start - now;
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        setTimeLeft(`Survey starts in: ${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (now > end) {
        setTimeLeft('Survey has ended');
        clearInterval(timer);
      } else {
        const distance = end - now;
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        setTimeLeft(`Time remaining: ${days}d ${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [settings]);

  if (!settings) return null;

  const startDate = settings.startDate instanceof Date ? settings.startDate : settings.startDate.toDate();
  const endDate = settings.endDate instanceof Date ? settings.endDate : settings.endDate.toDate();

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-6">
      <div className="text-center">
        <p className="text-lg font-semibold text-gray-700">{timeLeft}</p>
        <p className="text-sm text-gray-500 mt-2">
          {`${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`}
        </p>
      </div>
    </div>
  );
};

export default CountdownTimer;
