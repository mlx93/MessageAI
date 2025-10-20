import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBbPxZpMEjQCnGbXvZpJ39Vcaxhz6tiCkU",
  authDomain: "messageai-mlx93.firebaseapp.com",
  projectId: "messageai-mlx93",
  storageBucket: "messageai-mlx93.firebasestorage.app",
  messagingSenderId: "290630072291",
  appId: "1:290630072291:web:f5d7dcd8c1fac7b7c892d6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Enable offline persistence for Firestore
// This will cache data locally and sync when online
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser doesn't support persistence
      console.warn('Firestore persistence not supported in this environment');
    }
  });
} catch (error) {
  console.warn('Firestore persistence error:', error);
}

export default app;

