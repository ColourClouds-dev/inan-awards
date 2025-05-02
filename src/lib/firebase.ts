import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  Firestore, 
  enableIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';

// Add a utility function for retrying operations with exponential backoff
export async function retryOperation<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoffFactor = 2
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check if we should retry based on error types typically seen with network issues
    const isNetworkError = 
      error.code === 'unavailable' || 
      error.code === 'deadline-exceeded' ||
      error.message?.includes('network') ||
      error.message?.includes('timeout') ||
      error.message?.includes('connection');
      
    if (retries === 0 || !isNetworkError) {
      throw error;
    }
    
    console.log(`Retrying operation, ${retries} attempts remaining. Waiting ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return retryOperation(operation, retries - 1, delay * backoffFactor, backoffFactor);
  }
}

// Validate that all required environment variables are present
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'inan-awards.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validate config values
Object.entries(firebaseConfig).forEach(([key, value]) => {
  if (!value) {
    console.warn(`Missing Firebase configuration value for ${key}`);
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
    
    // Initialize Firestore with settings to improve reliability
    db = initializeFirestore(app, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      experimentalForceLongPolling: true, // Use long polling instead of WebSockets
    });
    
    // Enable offline persistence
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
      } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support all of the features required to enable persistence');
      } else {
        console.error('Error enabling persistence:', err);
      }
    });
    
    storage = getStorage(app);
    auth = getAuth(app);
    
    // Use emulators when in development
    if (process.env.NODE_ENV === 'development') {
      const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
      if (useEmulators) {
        connectFirestoreEmulator(db, 'localhost', 8080);
        connectAuthEmulator(auth, 'http://localhost:9099');
        console.log('Using Firebase emulators');
      }
    }
    
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    // Don't throw an error, just log it - allows the app to continue even with Firebase issues
    console.warn('App will continue with limited functionality');
  }
} else {
  app = getApps()[0];
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
}

export { app, db, storage, auth };
