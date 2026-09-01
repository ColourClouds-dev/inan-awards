import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "../../../lib/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/repair-claims
 * Re-stamps tenantId + role custom claims for the calling user.
 *
 * Called automatically by TenantContext when it detects that a user"s token
 * claims are missing but their tenant-admins document has the correct data
 * (e.g. Staff accounts registered before the invite flow bug was fixed).
 *
 * Security: the caller must supply a valid Firebase ID token. The requested
 * tenantId is cross-checked against the tenant-admins document so a user
 * cannot claim a tenantId they don"t belong to.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify the caller"s identity
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const idToken = authHeader.slice(7);
    const decoded = await getAuth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const { tenantId, role } = await req.json();
    if (!tenantId || !role) {
      return NextResponse.json({ error: "tenantId and role are required." }, { status: 400 });
    }

    const db = getAdminDb();

    // Cross-check: the requested tenantId must match what is in tenant-admins.
    // This prevents a user from self-assigning a different tenant.
    const adminSnap = await db.doc(`tenant-admins/${uid}`).get();
    if (!adminSnap.exists) {
      return NextResponse.json({ error: "User not found in tenant-admins." }, { status: 404 });
    }
    const adminData = adminSnap.data() as { tenantId: string; role: string };

    if (adminData.tenantId !== tenantId || adminData.role !== role) {
      return NextResponse.json(
        { error: "Requested claims do not match stored data." },
        { status: 403 }
      );
    }

    // Re-stamp the correct claims
    await getAuth().setCustomUserClaims(uid, { tenantId, role });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("repair-claims error:", err);
    return NextResponse.json({ error: "Failed to repair claims." }, { status: 500 });
  }
}
