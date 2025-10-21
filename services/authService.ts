/**
 * Authentication Service
 * 
 * Handles user authentication, registration, and profile management
 * Implements email/phone uniqueness via Firestore index collections
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from '../types';

/**
 * Phone number normalization - converts various formats to E.164
 * 
 * Accepts formats like:
 * - (555) 123-4567
 * - 555-123-4567
 * - 5551234567
 * - +15551234567
 * 
 * Returns E.164 format: +15551234567
 */
export const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If already has country code (starts with +), return as-is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If starts with 1 (US/Canada) and is 11 digits, add +
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return `+${cleaned}`;
  }
  
  // Otherwise assume US and add +1
  return `+1${cleaned}`;
};

/**
 * Sign up a new user with email/password
 * 
 * Creates:
 * 1. Firebase Auth user
 * 2. User profile in users/{uid}
 * 3. Email uniqueness index in usersByEmail/{email}
 * 4. Phone uniqueness index in usersByPhone/{phone}
 * 
 * Uses batch write for atomicity - if any part fails, entire operation rolls back
 * 
 * @throws Error if email or phone already exists
 */
export const signUp = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phoneNumber: string
): Promise<FirebaseUser> => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  // Create Firebase Auth user first
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Use batch write to create user profile + uniqueness indexes atomically
  const batch = writeBatch(db);
  
  const profile: User = {
    uid: user.uid,
    email,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    phoneNumber: normalizedPhone,
    photoURL: null,
    initials: `${firstName[0]}${lastName[0]}`.toUpperCase(),
    online: true,
    lastSeen: new Date(),
    createdAt: new Date(),
  };
  
  // User profile
  batch.set(doc(db, 'users', user.uid), profile);
  
  // Email uniqueness index
  batch.set(doc(db, 'usersByEmail', email), {
    uid: user.uid,
    createdAt: new Date(),
  });
  
  // Phone uniqueness index
  batch.set(doc(db, 'usersByPhone', normalizedPhone), {
    uid: user.uid,
    createdAt: new Date(),
  });
  
  try {
    await batch.commit();
    return user;
  } catch (error: any) {
    // If batch fails due to security rules (email/phone already exists), delete auth user
    await user.delete();
    
    if (error.code === 'permission-denied') {
      throw new Error('Email or phone number already in use');
    }
    throw error;
  }
};

/**
 * Sign in an existing user
 * Updates user's online status on successful login
 */
export const signIn = async (email: string, password: string): Promise<FirebaseUser> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  
  // Update online status
  await setDoc(
    doc(db, 'users', userCredential.user.uid),
    {
      online: true,
      lastSeen: new Date(),
    },
    { merge: true }
  );
  
  return userCredential.user;
};

/**
 * Sign out current user
 * Sets user's online status to false before signing out
 */
export const signOut = async (): Promise<void> => {
  if (auth.currentUser) {
    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      {
        online: false,
        lastSeen: new Date(),
      },
      { merge: true }
    );
  }
  
  await firebaseSignOut(auth);
};

/**
 * Get user profile from Firestore
 * 
 * @param uid - Firebase Auth user ID
 * @returns User profile or null if not found
 */
export const getUserProfile = async (uid: string): Promise<User | null> => {
  const docSnap = await getDoc(doc(db, 'users', uid));
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const data = docSnap.data();
  
  // Convert Firestore timestamps to Date objects
  return {
    ...data,
    lastSeen: data.lastSeen?.toDate() || new Date(),
    createdAt: data.createdAt?.toDate() || new Date(),
  } as User;
};

/**
 * Update user profile
 * 
 * @param uid - User ID
 * @param updates - Partial user data to update
 */
export const updateUserProfile = async (
  uid: string,
  updates: Partial<User>
): Promise<void> => {
  await setDoc(doc(db, 'users', uid), updates, { merge: true });
};

/**
 * Check if user profile is complete
 * Required fields: firstName, lastName, phoneNumber
 * 
 * @param profile - User profile to check
 * @returns true if profile has all required fields
 */
export const isProfileComplete = (profile: User | null): boolean => {
  if (!profile) return false;
  
  return !!(
    profile.firstName &&
    profile.lastName &&
    profile.phoneNumber &&
    profile.firstName.trim().length > 0 &&
    profile.lastName.trim().length > 0 &&
    profile.phoneNumber.trim().length > 0
  );
};

/**
 * Sign in with Google
 * Creates or retrieves user profile
 * 
 * @param idToken - Google ID token from OAuth
 * @returns Firebase user
 * @throws Error with code 'PHONE_REQUIRED' if phone number is missing
 */
export const signInWithGoogle = async (idToken: string): Promise<FirebaseUser> => {
  const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
  
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  const user = userCredential.user;
  
  // Check if user profile exists
  const existingProfile = await getUserProfile(user.uid);
  
  if (!existingProfile) {
    // Create new profile with Google data
    const names = user.displayName?.split(' ') || ['', ''];
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ') || '';
    
    const newProfile: User = {
      uid: user.uid,
      email: user.email || '',
      firstName,
      lastName,
      displayName: user.displayName || `${firstName} ${lastName}`,
      phoneNumber: '', // Will be collected later
      photoURL: user.photoURL,
      initials: firstName && lastName ? `${firstName[0]}${lastName[0]}`.toUpperCase() : '??',
      online: true,
      lastSeen: new Date(),
      createdAt: new Date(),
    };
    
    await setDoc(doc(db, 'users', user.uid), newProfile);
    
    // Phone number is required but not provided by Google
    throw new Error('PHONE_REQUIRED');
  }
  
  // Update online status
  await setDoc(
    doc(db, 'users', user.uid),
    {
      online: true,
      lastSeen: new Date(),
    },
    { merge: true }
  );
  
  // Check if phone number is missing
  if (!existingProfile.phoneNumber || existingProfile.phoneNumber.trim().length === 0) {
    throw new Error('PHONE_REQUIRED');
  }
  
  return user;
};

/**
 * Sign in with Apple
 * Creates or retrieves user profile
 * 
 * @param identityToken - Apple identity token
 * @param fullName - User's full name from Apple (optional)
 * @returns Firebase user
 * @throws Error with code 'PHONE_REQUIRED' if phone number is missing
 */
export const signInWithApple = async (
  identityToken: string,
  fullName?: { givenName?: string | null; familyName?: string | null }
): Promise<FirebaseUser> => {
  const { OAuthProvider, signInWithCredential } = await import('firebase/auth');
  
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: identityToken });
  const userCredential = await signInWithCredential(auth, credential);
  const user = userCredential.user;
  
  // Check if user profile exists
  const existingProfile = await getUserProfile(user.uid);
  
  if (!existingProfile) {
    // Create new profile with Apple data
    const firstName = fullName?.givenName || '';
    const lastName = fullName?.familyName || '';
    
    const newProfile: User = {
      uid: user.uid,
      email: user.email || '',
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`.trim() || user.email?.split('@')[0] || 'User',
      phoneNumber: '', // Will be collected later
      photoURL: user.photoURL,
      initials: firstName && lastName ? `${firstName[0]}${lastName[0]}`.toUpperCase() : '??',
      online: true,
      lastSeen: new Date(),
      createdAt: new Date(),
    };
    
    await setDoc(doc(db, 'users', user.uid), newProfile);
    
    // Phone number is required
    throw new Error('PHONE_REQUIRED');
  }
  
  // Update online status
  await setDoc(
    doc(db, 'users', user.uid),
    {
      online: true,
      lastSeen: new Date(),
    },
    { merge: true }
  );
  
  // Check if phone number is missing
  if (!existingProfile.phoneNumber || existingProfile.phoneNumber.trim().length === 0) {
    throw new Error('PHONE_REQUIRED');
  }
  
  return user;
};

