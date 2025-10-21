/**
 * Authentication Service
 * 
 * Handles user authentication, registration, and profile management
 * Implements phone number uniqueness via Firestore index collections
 * Phone numbers are the primary identifier for users
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, setDoc, getDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, functions } from './firebase';
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
 * 3. Phone uniqueness index in usersByPhone/{phone}
 * 
 * Uses batch write for atomicity - if any part fails, entire operation rolls back
 * 
 * @throws Error if phone number already exists
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
      throw new Error('Phone number already in use');
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
    console.log('❌ No user profile found for:', uid);
    return null;
  }
  
  const data = docSnap.data();
  
  // Convert Firestore timestamps to Date objects
  const profile = {
    ...data,
    lastSeen: data.lastSeen?.toDate() || new Date(),
    createdAt: data.createdAt?.toDate() || new Date(),
  } as User;
  
  console.log('📱 Loaded user profile:', {
    uid: profile.uid,
    displayName: profile.displayName,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phoneNumber: profile.phoneNumber
  });
  
  return profile;
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
 * Required fields: displayName and phoneNumber
 * 
 * @param profile - User profile to check
 * @returns true if profile has all required fields
 */
export const isProfileComplete = (profile: User | null): boolean => {
  if (!profile) return false;
  
  return !!(
    profile.displayName &&
    profile.phoneNumber &&
    profile.displayName.trim().length > 0 &&
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


/**
 * Phone Authentication Functions
 */

/**
 * Send phone verification code via SMS
 * 
 * Uses Cloud Function to generate and store OTP code
 * For test numbers (650-555-xxxx): Always uses code 123456
 * For real numbers: Generates code and can integrate Twilio for SMS
 * 
 * @param phoneNumber - Phone number in E.164 format (+1XXXXXXXXXX)
 * @returns Verification ID to use in verifyPhoneCode
 */
export const sendPhoneVerificationCode = async (phoneNumber: string): Promise<string> => {
  try {
    // Call Cloud Function to send verification code
    const sendCodeFunction = httpsCallable(functions, 'sendPhoneVerificationCode');
    const result = await sendCodeFunction({ phoneNumber });
    
    const data = result.data as { verificationId: string; testCode?: string };
    
    // Log test code if provided (for development)
    if (data.testCode) {
      console.log(`📱 Test phone number - Use code: ${data.testCode}`);
    }
    
    return data.verificationId;
  } catch (error: any) {
    console.error('Send phone verification error:', error);
    throw new Error(error.message || 'Failed to send verification code');
  }
};

/**
 * Verify phone code and sign in user
 * 
 * Uses Cloud Function to verify code and create/sign in user
 * 
 * @param verificationId - ID received from sendPhoneVerificationCode
 * @param code - 6-digit code entered by user
 * @returns User ID
 */
export const verifyPhoneCode = async (
  verificationId: string,
  code: string
): Promise<string> => {
  try {
    // Call Cloud Function to verify code
    const verifyCodeFunction = httpsCallable(functions, 'verifyPhoneCode');
    const result = await verifyCodeFunction({ verificationId, code });
    
    const data = result.data as { 
      success: boolean; 
      userId: string; 
      phoneNumber: string;
      email: string;
      password: string;
      isNewUser: boolean;
    };
    
    if (!data.success) {
      throw new Error('Verification failed');
    }
    
    // Sign in with temp email and password (created by Cloud Function)
    console.log(`🔐 Attempting sign-in with email: ${data.email}`);
    
    // Try signing in with retry for Android (password might need time to sync)
    let signInAttempts = 0;
    const maxAttempts = 3;
    
    while (signInAttempts < maxAttempts) {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        console.log(`✅ Phone verified and user signed in: ${data.userId}`);
        return userCredential.user.uid;
      } catch (signInError: any) {
        signInAttempts++;
        console.log(`⚠️ Sign-in attempt ${signInAttempts}/${maxAttempts} failed:`, signInError.code);
        
        if (signInAttempts < maxAttempts) {
          // Wait a bit before retrying (password might need time to propagate)
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          // Last attempt failed, throw error
          throw signInError;
        }
      }
    }
    
    throw new Error('Failed to sign in after multiple attempts');
  } catch (error: any) {
    console.error('Verify phone code error:', error);
    
    // Handle specific error messages from Cloud Function
    if (error.message?.includes('expired')) {
      throw new Error('Verification code expired. Please request a new code.');
    } else if (error.message?.includes('Invalid')) {
      throw new Error('Invalid verification code. Please try again.');
    }
    
    throw new Error(error.message || 'Failed to verify code');
  }
};

/**
 * Check if user profile exists in Firestore
 * 
 * @param userId - Firebase Auth user ID
 * @returns true if profile exists, false if new user
 */
export const checkIfUserExists = async (userId: string): Promise<boolean> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    return userDoc.exists();
  } catch (error) {
    console.error('Check user exists error:', error);
    return false;
  }
};

/**
 * Create user profile for phone-authenticated user
 * 
 * @param userId - Firebase Auth user ID
 * @param phoneNumber - Phone number in E.164 format
 * @param displayName - User's display name
 * @param email - Optional email for account recovery
 */
export const createUserProfileWithPhone = async (
  userId: string,
  phoneNumber: string,
  displayName: string,
  email?: string,
  firstName?: string,
  lastName?: string
): Promise<void> => {
  try {
    // If firstName/lastName not provided, derive from displayName
    let first = firstName;
    let last = lastName;
    
    if (!first || !last) {
      const nameParts = displayName.trim().split(' ');
      first = first || nameParts[0] || '';
      last = last || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '');
    }

    // Generate initials
    const initials = (first && last)
      ? `${first[0]}${last[0]}`.toUpperCase()
      : displayName.substring(0, 2).toUpperCase();

    console.log('📝 Creating profile:', { userId, phoneNumber, displayName, email, firstName: first, lastName: last, initials });

    // Create user profile
    const userProfile: User = {
      uid: userId,
      email: email || '',
      displayName,
      phoneNumber,
      photoURL: null,
      initials,
      online: true,
      lastSeen: new Date(),
      createdAt: new Date(),
      firstName: first,
      lastName: last,
    };

    // Use batch write for atomicity
    const batch = writeBatch(db);

    // Write user profile (merge to avoid overwriting existing data)
    batch.set(doc(db, 'users', userId), userProfile, { merge: true });

    // Create/update phone number index for uniqueness
    batch.set(doc(db, 'usersByPhone', phoneNumber), {
      uid: userId,
      createdAt: new Date(),
    }, { merge: true });

    await batch.commit();
    
    console.log(`✅ User profile created successfully:`, userProfile);
  } catch (error: any) {
    console.error('Create user profile error:', error);
    throw new Error(error.message || 'Failed to create user profile');
  }
};
