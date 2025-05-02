import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDFWzcM00aXC0suD5akat20PgutkFcEk50",
  authDomain: "inan-survey.firebaseapp.com",
  projectId: "inan-survey",
  storageBucket: "inan-survey.firestorage.app",
  messagingSenderId: "646797959509",
  appId: "1:646797959509:web:56526c177d454533d1cfdc",
  measurementId: "G-372TG4W585"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const email = 'adminaccess@inan.com.ng';
const password = 'Fishfood1234$';

async function setupAdminUser() {
  try {
    // Create new admin user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('Admin user created successfully:', userCredential.user.email);
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('Admin user already exists');
      process.exit(0);
    } else {
      console.error('Error setting up admin user:', error);
      process.exit(1);
    }
  }
}

setupAdminUser();
