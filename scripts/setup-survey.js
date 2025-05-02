import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
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
    // Sign in as admin
    const userCredential = await signInWithEmailAndPassword(auth, 'adminaccess@inan.com.ng', process.env.ADMIN_PASSWORD);
    console.log('Admin authenticated successfully');
    
    // Wait for auth state to propagate
    console.log('Waiting for auth state to propagate...');
    await wait(2000);
    
    console.log('Current user:', auth.currentUser?.email);
    
    // Set default survey settings
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1); // Set end date to 1 month from now

    const settingsData = {
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(endDate),
      isActive: true,
      bannerImageUrl: '' // Optional banner image URL
    };

    console.log('Attempting to write settings:', settingsData);
    
    await setDoc(doc(db, 'settings', 'survey'), settingsData);
    console.log('Survey settings created successfully!');
    
    // Wait before exiting to ensure write completes
    await wait(1000);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

// Check if admin password is provided
if (!process.env.ADMIN_PASSWORD) {
  console.error('Error: ADMIN_PASSWORD environment variable is required');
  process.exit(1);
}

setupSurveySettings();
