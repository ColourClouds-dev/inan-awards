import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { tenantId, employees } = await req.json();

    if (!tenantId || !Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json({ error: 'tenantId and employees array are required.' }, { status: 400 });
    }

    const db = getAdminDb();
    const BATCH_SIZE = 400;

    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      const chunk = employees.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      chunk.forEach((emp: Record<string, unknown>, idx: number) => {
        const id = `${tenantId}_${i + idx + 1}`;
        batch.set(db.doc(`employees/${id}`), { ...emp, tenantId });
      });
      await batch.commit();
    }

    return NextResponse.json({ success: true, count: employees.length });
  } catch (err) {
    console.error('Import employees error:', err);
    return NextResponse.json({ error: 'Failed to import employees.' }, { status: 500 });
  }
}
