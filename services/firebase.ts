import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Initialize Firebase Auth with React Native persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Note: Firestore persistence is automatic on React Native
// No need for enableIndexedDbPersistence (that's web-only)
// Data is cached by default in React Native

export default app;

