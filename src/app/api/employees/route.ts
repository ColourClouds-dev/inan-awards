import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from '../../../lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

async function verifyAuth(req: NextRequest): Promise<{ uid: string; tenantId: string; role: string; superAdmin?: boolean } | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    const decoded = await getAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      tenantId: decoded.tenantId as string,
      role: decoded.role as string,
      superAdmin: decoded.superAdmin as boolean | undefined
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = await verifyAuth(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = request.headers.get('x-tenant-id') || token.tenantId;
    
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const db = getAdminDb();
    const snap = await db.collection('employees').where('tenantId', '==', tenantId).get();
    const employees = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort by employee name (Employee field)
    employees.sort((a: any, b: any) => {
      const nameA = a.Employee || '';
      const nameB = b.Employee || '';
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Failed to fetch employees API error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}
