import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Initialize Firebase with correct config from Firebase console
const firebaseConfig = {
  apiKey: "AIzaSyDFWzcM00aXC0suD5akat20PgutkFcEk50",
  authDomain: "inan-survey.firebaseapp.com",
  projectId: "inan-survey",
  storageBucket: "inan-survey.firebasestorage.app",
  messagingSenderId: "646797959509",
  appId: "1:646797959509:web:56526c177d454533d1cfdc",
  measurementId: "G-372TG4W585"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function setupSurveySettings() {
  try {
    // Check if settings document already exists
    const settingsRef = doc(db, 'settings', 'survey');
    const settingsSnapshot = await getDoc(settingsRef);

    if (settingsSnapshot.exists()) {
      console.log('Survey settings already exist. Not overwriting.');
      return;
    }

    // Set default survey settings
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

    console.log('Attempting to write settings:', settingsData);

    await setDoc(doc(db, 'settings', 'survey'), settingsData);
    console.log('Survey settings created successfully!');
  } catch (error) {
    console.error('Error setting up survey settings:', error);
  }
}

// Check if admin password is provided
if (!process.env.ADMIN_PASSWORD) {
  console.error('Error: ADMIN_PASSWORD environment variable is required');
  process.exit(1);
}

setupSurveySettings();
