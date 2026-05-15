import { NextRequest, NextResponse } from 'next/server';

// Only map domains that should always resolve to a specific tenant.
// localhost is intentionally NOT mapped here — tenant resolution falls
// through to the x-tenant-id header from the cookie or domain lookup,
// which allows multiple tenants to work correctly in local development.
const DOMAIN_TO_TENANT: Record<string, string> = {
  'feedback.inan.com.ng': 'inan',
  'inan.inanfeedback.com': 'inan',
};

const IMPERSONATE_COOKIE = 'sa-impersonate';

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const domain = host.replace(/^www\./, '');

  // Check if super admin is impersonating a tenant
  const impersonateCookie = req.cookies.get(IMPERSONATE_COOKIE)?.value;

  // Resolve tenantId: impersonation takes priority, then static map, then fall back to inan
  // localhost is NOT in the static map — the /api/tenant/current route handles
  // per-user tenant resolution via the auth token on the client side.
  const tenantId = impersonateCookie || DOMAIN_TO_TENANT[domain] || 'inan';

  const response = NextResponse.next();
  response.headers.set('x-tenant-id', tenantId);
  response.headers.set('x-tenant-domain', domain);
  response.headers.set('x-impersonating', impersonateCookie ? 'true' : 'false');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
