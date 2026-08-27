import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function backfillFormCreatedBy() {
  console.log('🔧 Backfilling createdBy field for legacy forms...\n');
  
  try {
    // Find forms without createdBy field
    const formsSnapshot = await db.collection('feedback-forms').get();
    
    const formsToFix = [];
    const tenantOwners = {}; // Cache of tenant -> owner UID mapping
    
    // First pass: identify forms needing backfill
    formsSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.createdBy) {
        formsToFix.push({
          id: doc.id,
          title: data.title,
          tenantId: data.tenantId,
          isActive: data.isActive,
          createdAt: data.createdAt
        });
      }
    });
    
    if (formsToFix.length === 0) {
      console.log('✅ No forms need backfilling - all have createdBy field');
      return;
    }
    
    console.log(`📋 Found ${formsToFix.length} forms needing createdBy field:`);
    formsToFix.forEach(form => {
      console.log(`   - ${form.id}: "${form.title}" (Tenant: ${form.tenantId})`);
    });
    
    // Get tenant owners for assignment
    console.log('\n👥 Finding tenant owners...');
    const adminsSnapshot = await db.collection('tenant-admins')
      .where('role', '==', 'owner')
      .get();
    
    adminsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.tenantId && data.uid) {
        tenantOwners[data.tenantId] = data.uid;
      }
    });
    
    console.log('📊 Tenant owners found:');
    Object.entries(tenantOwners).forEach(([tenantId, ownerUid]) => {
      console.log(`   - ${tenantId}: ${ownerUid}`);
    });
    
    // Strategy for assignment
    console.log('\n🎯 Assignment Strategy:');
    console.log('   - Forms will be assigned to tenant owner (if found)');
    console.log('   - Forms without owner will be assigned to "system"');
    console.log('   - This makes legacy forms visible only to admins until reassigned');
    
    // Confirm before proceeding
    console.log('\n⚠️  This will modify forms in Firestore. Proceed? (y/N)');
    
    // For script safety, require manual confirmation
    // In a real scenario, you might want to add readline for interactive confirmation
    const PROCEED = process.env.CONFIRM_BACKFILL === 'yes';
    
    if (!PROCEED) {
      console.log('❌ Backfill cancelled. Set CONFIRM_BACKFILL=yes to proceed.');
      console.log('   Example: CONFIRM_BACKFILL=yes node scripts/backfill-form-created-by.js');
      return;
    }
    
    // Perform backfill
    console.log('\n🔧 Performing backfill...');
    const batch = db.batch();
    let fixCount = 0;
    
    formsToFix.forEach(form => {
      const ownerUid = tenantOwners[form.tenantId];
      const createdBy = ownerUid || 'system';
      
      console.log(`📝 Assigning ${form.id} to ${createdBy} (${ownerUid ? 'owner' : 'system'})`);
      
      const formRef = db.doc(`feedback-forms/${form.id}`);
      batch.update(formRef, { createdBy });
      fixCount++;
    });
    
    if (fixCount > 0) {
      await batch.commit();
      console.log(`\n✅ Successfully updated ${fixCount} forms`);
      
      // Summary
      console.log('\n📊 Backfill Summary:');
      const assignmentStats = {};
      formsToFix.forEach(form => {
        const ownerUid = tenantOwners[form.tenantId];
        const createdBy = ownerUid || 'system';
        assignmentStats[createdBy] = (assignmentStats[createdBy] || 0) + 1;
      });
      
      Object.entries(assignmentStats).forEach(([createdBy, count]) => {
        console.log(`   - ${createdBy}: ${count} form(s)`);
      });
      
      console.log('\n🔄 Next Steps:');
      console.log('   1. Verify staff users can only see their own forms');
      console.log('   2. Reassign "system" forms to appropriate users if needed');
      console.log('   3. Test form creation to ensure createdBy is set automatically');
      
    } else {
      console.log('✅ No changes needed');
    }
    
  } catch (error) {
    console.error('❌ Error during backfill:', error);
  }
}

// Run backfill
backfillFormCreatedBy()
  .then(() => console.log('\n✅ Backfill process completed'))
  .catch(console.error);