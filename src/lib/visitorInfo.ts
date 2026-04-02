'use client';

export interface VisitorInfo {
  ip: string;
  city: string;
  region: string;
  country: string;
  isp: string;
  accessedAt: string;
}

export async function getVisitorInfo(): Promise<VisitorInfo> {
  try {
    const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch IP info');
    const data = await res.json();
    return {
      ip: data.ip ?? 'unknown',
      city: data.city ?? 'unknown',
      region: data.region ?? 'unknown',
      country: data.country_name ?? 'unknown',
      isp: data.org ?? 'unknown',
      accessedAt: new Date().toISOString(),
    };
  } catch {
    return {
      ip: 'unknown',
      city: 'unknown',
      region: 'unknown',
      country: 'unknown',
      isp: 'unknown',
      accessedAt: new Date().toISOString(),
    };
  }
}
