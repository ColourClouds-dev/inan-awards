import { NextRequest, NextResponse } from 'next/server';

const DOMAIN_TO_TENANT: Record<string, string> = {
  'localhost:3000': 'inan',
  'localhost:3001': 'inan',
};

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';

  // Strip www. prefix
  const domain = host.replace(/^www\./, '');

  // Check static map first (for dev)
  let tenantId = DOMAIN_TO_TENANT[domain];

  // If not in static map, derive from domain
  // e.g. feedback.inan.com.ng -> look up in Firestore
  // For now, pass domain as header and let the app resolve it

  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenantId ?? '');
  response.headers.set('x-tenant-domain', domain);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
