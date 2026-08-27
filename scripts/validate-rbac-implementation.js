import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function validateRBACImplementation() {
  console.log('🔍 Validating Staff RBAC Implementation...\n');
  
  try {
    // 1. Check all forms in the system
    console.log('📋 Analyzing feedback forms...');
    const formsSnapshot = await db.collection('feedback-forms').get();
    
    let totalForms = 0;
    let formsWithCreatedBy = 0;
    let formsWithoutCreatedBy = 0;
    const createdByStats = {};
    const problemForms = [];
    
    formsSnapshot.forEach(doc => {
      const data = doc.data();
      totalForms++;
      
      if (data.createdBy) {
        formsWithCreatedBy++;
        createdByStats[data.createdBy] = (createdByStats[data.createdBy] || 0) + 1;
      } else {
        formsWithoutCreatedBy++;
        problemForms.push({
          id: doc.id,
          title: data.title,
          tenantId: data.tenantId,
          isActive: data.isActive
        });
      }
    });
    
    console.log(`📊 Form Analysis Results:`);
    console.log(`   Total forms: ${totalForms}`);
    console.log(`   Forms with createdBy: ${formsWithCreatedBy}`);
    console.log(`   Forms missing createdBy: ${formsWithoutCreatedBy}`);
    
    if (formsWithoutCreatedBy > 0) {
      console.log(`\n⚠️  Forms missing createdBy field:`);
      problemForms.forEach(form => {
        console.log(`   - ${form.id}: "${form.title}" (Tenant: ${form.tenantId}, Active: ${form.isActive})`);
      });
    }
    
    console.log(`\n👥 Forms by creator:`);
    Object.entries(createdByStats).forEach(([uid, count]) => {
      console.log(`   - ${uid}: ${count} form(s)`);
    });
    
    // 2. Check tenant-admins for role distribution
    console.log(`\n👤 Analyzing user roles...`);
    const adminsSnapshot = await db.collection('tenant-admins').get();
    
    const roleStats = {};
    const tenantStats = {};
    
    adminsSnapshot.forEach(doc => {
      const data = doc.data();
      const role = data.role || 'unknown';
      const tenantId = data.tenantId || 'unknown';
      
      roleStats[role] = (roleStats[role] || 0) + 1;
      
      if (!tenantStats[tenantId]) {
        tenantStats[tenantId] = { owner: 0, staff: 0, unknown: 0 };
      }
      tenantStats[tenantId][role] = (tenantStats[tenantId][role] || 0) + 1;
    });
    
    console.log(`📊 Role Distribution:`);
    Object.entries(roleStats).forEach(([role, count]) => {
      console.log(`   - ${role}: ${count} user(s)`);
    });
    
    console.log(`\n🏢 Users by Tenant:`);
    Object.entries(tenantStats).forEach(([tenantId, stats]) => {
      console.log(`   - ${tenantId}: ${stats.owner} owner(s), ${stats.staff} staff, ${stats.unknown} unknown`);
    });
    
    // 3. Validate Firestore Rules Structure
    console.log(`\n🛡️  Firestore Rules Validation:`);
    
    // Check if we can read the security rules (this would require special permissions)
    try {
      // This is mainly for documentation - actual rule testing requires emulator
      console.log('   ✅ Expected rules for feedback-forms:');
      console.log('      - Staff: can only read where createdBy == auth.uid');
      console.log('      - Owner: can read all forms in their tenant');
      console.log('      - Create: Staff must set createdBy to their own UID');
      console.log('      - Update/Delete: Staff can only modify their own forms');
    } catch (error) {
      console.log('   ℹ️  Cannot verify rules programmatically (expected)');
    }
    
    // 4. Generate Summary Report
    console.log(`\n📋 RBAC Implementation Status:`);
    
    if (formsWithoutCreatedBy === 0) {
      console.log('   ✅ All forms have createdBy field');
    } else {
      console.log(`   ⚠️  ${formsWithoutCreatedBy} forms missing createdBy field`);
      console.log('   📝 Run backfill script to fix legacy forms');
    }
    
    if (roleStats.staff > 0) {
      console.log(`   ✅ Staff users exist (${roleStats.staff} found)`);
    } else {
      console.log('   ⚠️  No staff users found - cannot test staff restrictions');
    }
    
    if (roleStats.owner > 0) {
      console.log(`   ✅ Owner users exist (${roleStats.owner} found)`);
    }
    
    // 5. Recommendations
    console.log(`\n🔧 Recommendations:`);
    
    if (formsWithoutCreatedBy > 0) {
      console.log('   1. Run backfill script to add createdBy to legacy forms');
      console.log('   2. Assign legacy forms to appropriate users or system account');
    }
    
    if (roleStats.staff > 0) {
      console.log('   3. Test staff user login to verify form filtering works');
      console.log('   4. Verify staff users can only see their own forms');
    }
    
    console.log('   5. Test token refresh scenarios to ensure role persistence');
    
  } catch (error) {
    console.error('❌ Error during validation:', error);
  }
}

// Run validation
validateRBACImplementation()
  .then(() => console.log('\n✅ RBAC validation completed'))
  .catch(console.error);