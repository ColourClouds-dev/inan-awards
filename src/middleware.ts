import { NextRequest, NextResponse } from 'next/server';

const DOMAIN_TO_TENANT: Record<string, string> = {
  'localhost:3000': 'inan',
  'localhost:3001': 'inan',
};

const IMPERSONATE_COOKIE = 'sa-impersonate';

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const domain = host.replace(/^www\./, '');

  // Check if super admin is impersonating a tenant
  const impersonateCookie = req.cookies.get(IMPERSONATE_COOKIE)?.value;

  // Resolve tenantId: impersonation takes priority, then static map, then domain header
  let tenantId = impersonateCookie || DOMAIN_TO_TENANT[domain] || '';

  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenantId);
  response.headers.set('x-tenant-domain', domain);
  // Pass impersonation flag so the app can show the banner
  response.headers.set('x-impersonating', impersonateCookie ? 'true' : 'false');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
