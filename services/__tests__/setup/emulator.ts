/**
 * Firebase Emulator Setup for Integration Tests
 * 
 * This file configures Firebase to use local emulators during testing.
 * Run emulators with: firebase emulators:start
 * 
 * Emulator ports (from firebase.json):
 * - Auth: 9099
 * - Firestore: 8080
 * - Functions: 5001
 */

import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { initializeApp, getApps, deleteApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: "test-api-key",
  authDomain: "messageai-test.firebaseapp.com",
  projectId: "messageai-test",
  storageBucket: "messageai-test.appspot.com",
  messagingSenderId: "123456789",
  appId: "test-app-id"
};

let testApp: any = null;
let isEmulatorConnected = false;

/**
 * Initialize Firebase with emulator connections
 */
export function setupEmulator() {
  if (testApp) {
    return { auth: getAuth(testApp), db: getFirestore(testApp), functions: getFunctions(testApp), storage: getStorage(testApp) };
  }

  // Clean up existing apps
  getApps().forEach(app => deleteApp(app));

  // Initialize new test app
  testApp = initializeApp(firebaseConfig, 'test-app');

  const auth = getAuth(testApp);
  const db = getFirestore(testApp);
  const functions = getFunctions(testApp);
  const storage = getStorage(testApp);

  // Connect to emulators (only once)
  if (!isEmulatorConnected) {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectFunctionsEmulator(functions, 'localhost', 5001);
      connectStorageEmulator(storage, 'localhost', 9199);
      isEmulatorConnected = true;
    } catch (error) {
      // Emulator might already be connected, ignore
      console.warn('Emulator connection warning (likely already connected):', error);
    }
  }

  return { auth, db, functions, storage };
}

/**
 * Clean up test app after tests
 */
export async function teardownEmulator() {
  if (testApp) {
    await deleteApp(testApp);
    testApp = null;
  }
  isEmulatorConnected = false;
}

/**
 * Clear all Firestore data (useful between tests)
 */
export async function clearFirestoreData() {
  const { db } = setupEmulator();
  // This would require admin SDK or emulator REST API
  // For now, we'll rely on test isolation
  console.log('Note: Firestore data clearing requires manual cleanup or emulator REST API');
}

