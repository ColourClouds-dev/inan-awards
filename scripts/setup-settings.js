import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase configuration - use the same config as in setup-survey.js
const firebaseConfig = {
  apiKey: "AIzaSyDFWzcM00aXC0suD5akat20PgutkFcEk50",
  authDomain: "inan-survey.firebaseapp.com",
  projectId: "inan-survey",
  storageBucket: "inan-survey.firebasestorage.app",
  messagingSenderId: "646797959509",
  appId: "1:646797959509:web:56526c177d454533d1cfdc",
  measurementId: "G-372TG4W585"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function setupSystemSettings() {
  try {
    // Skip authentication for now since we're having issues with the password
    console.log('Setting up system settings...');
    
    // Check if settings document already exists
    const settingsRef = doc(db, 'settings', 'survey');
    const settingsSnapshot = await getDoc(settingsRef);

    if (settingsSnapshot.exists()) {
      console.log('System settings already exist.');
      console.log('Updating with new fields if needed...');
      
      const existingData = settingsSnapshot.data();
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      // Create updated settings by merging existing with new defaults
      const updatedSettings = {
        // Base settings (use existing or defaults)
        startDate: existingData.startDate || Timestamp.fromDate(now),
        endDate: existingData.endDate || Timestamp.fromDate(nextMonth),
        isActive: existingData.isActive !== undefined ? existingData.isActive : true,
        bannerImageUrl: existingData.bannerImageUrl || '',
        
        // Appearance settings
        appearance: {
          primaryColor: existingData.appearance?.primaryColor || '#6366F1',
          secondaryColor: existingData.appearance?.secondaryColor || '#8B5CF6',
          logoUrl: existingData.appearance?.logoUrl || '',
          customCss: existingData.appearance?.customCss || ''
        },
        
        // Response management
        responseManagement: {
          dataRetentionDays: existingData.responseManagement?.dataRetentionDays || 0,
          autoArchiveAfterDays: existingData.responseManagement?.autoArchiveAfterDays || 90,
          responseLimit: existingData.responseManagement?.responseLimit || 0
        },
        
        // Notifications
        notifications: {
          emailNotifications: existingData.notifications?.emailNotifications || false,
          notificationEmail: existingData.notifications?.notificationEmail || '',
          alertThreshold: existingData.notifications?.alertThreshold || 10,
          dailyDigest: existingData.notifications?.dailyDigest || false
        },
        
        // Security
        security: {
          enableRecaptcha: existingData.security?.enableRecaptcha || false,
          allowedIpRanges: existingData.security?.allowedIpRanges || [],
          requireVerification: existingData.security?.requireVerification || false
        },
        
        // Integrations
        integrations: {
          apiKeys: existingData.integrations?.apiKeys || {},
          webhookUrl: existingData.integrations?.webhookUrl || '',
          exportFormat: existingData.integrations?.exportFormat || 'csv'
        },
        
        // Defaults
        defaults: {
          defaultExpiryDays: existingData.defaults?.defaultExpiryDays || 30,
          footerText: existingData.defaults?.footerText || '© 2023 Inan Awards. All rights reserved.',
          disclaimer: existingData.defaults?.disclaimer || 'Your privacy is important to us. All responses are confidential and will be used only for the intended purpose.'
        }
      };
      
      await setDoc(doc(db, 'settings', 'survey'), updatedSettings);
      console.log('System settings updated successfully!');
    } else {
      console.log('Creating new system settings...');
      
      // Set default system settings
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      const settingsData = {
        startDate: Timestamp.fromDate(now),
        endDate: Timestamp.fromDate(nextMonth),
        isActive: true,
        bannerImageUrl: '',
        
        // New settings
        appearance: {
          primaryColor: '#6366F1',
          secondaryColor: '#8B5CF6',
          logoUrl: '',
          customCss: ''
        },
        
        responseManagement: {
          dataRetentionDays: 0, // Keep indefinitely
          autoArchiveAfterDays: 90,
          responseLimit: 0 // No limit
        },
        
        notifications: {
          emailNotifications: false,
          notificationEmail: '',
          alertThreshold: 10,
          dailyDigest: false
        },
        
        security: {
          enableRecaptcha: false,
          allowedIpRanges: [],
          requireVerification: false
        },
        
        integrations: {
          apiKeys: {},
          webhookUrl: '',
          exportFormat: 'csv'
        },
        
        defaults: {
          defaultExpiryDays: 30,
          footerText: '© 2023 Inan Awards. All rights reserved.',
          disclaimer: 'Your privacy is important to us. All responses are confidential and will be used only for the intended purpose.'
        }
      };

      await setDoc(doc(db, 'settings', 'survey'), settingsData);
      console.log('System settings created successfully!');
    }
    
    // Wait for changes to write
    await wait(1000);
    console.log('Setup complete!');
    
  } catch (error) {
    console.error('Error setting up system settings:', error);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

// Run the setup
setupSystemSettings(); 