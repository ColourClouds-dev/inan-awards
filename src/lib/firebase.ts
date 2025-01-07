import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';

// Validate that all required environment variables are present
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate config values
Object.entries(firebaseConfig).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`Missing Firebase configuration value for ${key}`);
  }
});

let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;
let auth: Auth;

// Initialize Firebase only if it hasn't been initialized yet
if (!getApps().length) {
  try {
    console.log('Initializing Firebase...');
    app = initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw new Error('Failed to initialize Firebase. Please check your configuration.');
  }
} else {
  app = getApps()[0];
}

// Initialize Firebase services
try {
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
  console.log('Firebase services initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase services:', error);
  throw new Error('Failed to initialize Firebase services.');
}

export { app, db, storage, auth };
