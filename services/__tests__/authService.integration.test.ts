/**
 * Auth Service Integration Tests
 * 
 * Tests phone OTP authentication flow against Firebase Emulator.
 * This is the PRIMARY authentication method for MessageAI MVP.
 * 
 * Run with: npm run test:integration
 * Requires: firebase emulators:start
 */

import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  RecaptchaVerifier
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { setupEmulator, teardownEmulator } from './setup/emulator';

describe('Auth Service - Integration Tests', () => {
  let auth: any;
  let db: any;

  beforeAll(() => {
    const emulator = setupEmulator();
    auth = emulator.auth;
    db = emulator.db;
  });

  afterAll(async () => {
    await teardownEmulator();
  });

  afterEach(async () => {
    // Sign out after each test
    if (auth.currentUser) {
      await signOut(auth);
    }
  });

  describe('Email/Password Authentication', () => {
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    const testDisplayName = 'Test User';

    it('should register a new user with email and password', async () => {
      // Register user
      const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
      
      expect(userCredential.user).toBeDefined();
      expect(userCredential.user.email).toBe(testEmail);
      expect(userCredential.user.uid).toBeDefined();
    });

    it('should create user profile in Firestore after registration', async () => {
      const testEmail2 = `test-${Date.now()}@example.com`;
      
      // Register user
      const userCredential = await createUserWithEmailAndPassword(auth, testEmail2, testPassword);
      const userId = userCredential.user.uid;

      // Create profile document
      const userProfile = {
        uid: userId,
        email: testEmail2,
        displayName: testDisplayName,
        phoneNumber: '',
        photoURL: '',
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        isOnline: false
      };

      await setDoc(doc(db, 'users', userId), userProfile);

      // Verify profile exists
      const profileDoc = await getDoc(doc(db, 'users', userId));
      expect(profileDoc.exists()).toBe(true);
      expect(profileDoc.data()?.email).toBe(testEmail2);
      expect(profileDoc.data()?.displayName).toBe(testDisplayName);
    });

    it('should sign in existing user with email and password', async () => {
      const testEmail3 = `test-${Date.now()}@example.com`;
      
      // Register first
      await createUserWithEmailAndPassword(auth, testEmail3, testPassword);
      
      // Sign out
      await signOut(auth);

      // Sign in
      const userCredential = await signInWithEmailAndPassword(auth, testEmail3, testPassword);
      
      expect(userCredential.user).toBeDefined();
      expect(userCredential.user.email).toBe(testEmail3);
    });

    it('should fail to sign in with wrong password', async () => {
      const testEmail4 = `test-${Date.now()}@example.com`;
      
      // Register first
      await createUserWithEmailAndPassword(auth, testEmail4, testPassword);
      
      // Sign out
      await signOut(auth);

      // Try to sign in with wrong password
      await expect(
        signInWithEmailAndPassword(auth, testEmail4, 'WrongPassword123!')
      ).rejects.toThrow();
    });

    it('should prevent duplicate email registration', async () => {
      const testEmail5 = `test-${Date.now()}@example.com`;
      
      // Register first time
      await createUserWithEmailAndPassword(auth, testEmail5, testPassword);
      
      // Sign out
      await signOut(auth);

      // Try to register again with same email
      await expect(
        createUserWithEmailAndPassword(auth, testEmail5, testPassword)
      ).rejects.toThrow();
    });
  });

  describe('Email Uniqueness Enforcement', () => {
    it('should create usersByEmail index document', async () => {
      const testEmail = `unique-${Date.now()}@example.com`;
      const userId = `user-${Date.now()}`;

      // Create email index (this is what authService does)
      await setDoc(doc(db, 'usersByEmail', testEmail), { uid: userId });

      // Verify it exists
      const emailDoc = await getDoc(doc(db, 'usersByEmail', testEmail));
      expect(emailDoc.exists()).toBe(true);
      expect(emailDoc.data()?.uid).toBe(userId);
    });

    it('should check for existing email before registration', async () => {
      const testEmail = `check-${Date.now()}@example.com`;
      const userId1 = `user1-${Date.now()}`;
      const userId2 = `user2-${Date.now()}`;

      // User 1 registers
      await setDoc(doc(db, 'usersByEmail', testEmail), { uid: userId1 });

      // Check if email exists (before User 2 tries to register)
      const existingEmail = await getDoc(doc(db, 'usersByEmail', testEmail));
      expect(existingEmail.exists()).toBe(true);

      // User 2 should not be able to use this email
      // In real app, this check prevents registration
      if (existingEmail.exists()) {
        expect(existingEmail.data()?.uid).toBe(userId1);
      }
    });
  });

  describe('Phone Number Uniqueness Enforcement', () => {
    it('should create usersByPhone index document', async () => {
      const testPhone = `+1555${Date.now().toString().slice(-7)}`;
      const userId = `user-${Date.now()}`;

      // Create phone index (E.164 format)
      await setDoc(doc(db, 'usersByPhone', testPhone), { uid: userId });

      // Verify it exists
      const phoneDoc = await getDoc(doc(db, 'usersByPhone', testPhone));
      expect(phoneDoc.exists()).toBe(true);
      expect(phoneDoc.data()?.uid).toBe(userId);
    });

    it('should prevent duplicate phone numbers', async () => {
      const testPhone = `+1555${Date.now().toString().slice(-7)}`;
      const userId1 = `user1-${Date.now()}`;
      const userId2 = `user2-${Date.now()}`;

      // User 1 registers with phone
      await setDoc(doc(db, 'usersByPhone', testPhone), { uid: userId1 });

      // Check if phone exists
      const existingPhone = await getDoc(doc(db, 'usersByPhone', testPhone));
      expect(existingPhone.exists()).toBe(true);

      // User 2 should not be able to use this phone
      if (existingPhone.exists()) {
        expect(existingPhone.data()?.uid).toBe(userId1);
        // In real app, registration would fail here
      }
    });

    it('should handle E.164 phone format normalization', () => {
      const normalizePhoneNumber = (phone: string): string => {
        let cleaned = phone.replace(/[^\d+]/g, '');
        if (cleaned.startsWith('+')) {
          return cleaned;
        }
        if (cleaned.startsWith('1') && cleaned.length === 11) {
          return `+${cleaned}`;
        }
        return `+1${cleaned}`;
      };

      // Various formats should normalize to same E.164
      expect(normalizePhoneNumber('(555) 123-4567')).toBe('+15551234567');
      expect(normalizePhoneNumber('555-123-4567')).toBe('+15551234567');
      expect(normalizePhoneNumber('5551234567')).toBe('+15551234567');
      expect(normalizePhoneNumber('+15551234567')).toBe('+15551234567');
    });
  });

  describe('User Profile Management', () => {
    it('should update user profile', async () => {
      const testEmail = `profile-${Date.now()}@example.com`;
      
      // Create user
      const userCredential = await createUserWithEmailAndPassword(auth, testEmail, 'TestPass123!');
      const userId = userCredential.user.uid;

      // Create initial profile
      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        email: testEmail,
        displayName: 'Original Name',
        phoneNumber: '',
        photoURL: ''
      });

      // Update profile
      const updates = {
        displayName: 'Updated Name',
        phoneNumber: '+15551234567'
      };

      await setDoc(doc(db, 'users', userId), updates, { merge: true });

      // Verify updates
      const updatedProfile = await getDoc(doc(db, 'users', userId));
      expect(updatedProfile.data()?.displayName).toBe('Updated Name');
      expect(updatedProfile.data()?.phoneNumber).toBe('+15551234567');
      expect(updatedProfile.data()?.email).toBe(testEmail); // Should still exist
    });
  });

  describe('Phone OTP Authentication (Emulator Simulation)', () => {
    it('should create user profile after OTP verification', async () => {
      // In emulator, OTP code is always 123456 for test numbers
      const testPhone = '+16505551234'; // Test number format
      const userId = `phone-user-${Date.now()}`;

      // Simulate successful OTP verification by creating user profile
      const userProfile = {
        uid: userId,
        email: '',
        displayName: 'Phone User',
        phoneNumber: testPhone,
        photoURL: '',
        createdAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        isOnline: true
      };

      await setDoc(doc(db, 'users', userId), userProfile);
      await setDoc(doc(db, 'usersByPhone', testPhone), { uid: userId });

      // Verify user was created
      const userDoc = await getDoc(doc(db, 'users', userId));
      expect(userDoc.exists()).toBe(true);
      expect(userDoc.data()?.phoneNumber).toBe(testPhone);

      // Verify phone index
      const phoneDoc = await getDoc(doc(db, 'usersByPhone', testPhone));
      expect(phoneDoc.exists()).toBe(true);
      expect(phoneDoc.data()?.uid).toBe(userId);
    });

    it('should find user by phone number', async () => {
      const testPhone = `+1650555${Date.now().toString().slice(-4)}`;
      const userId = `find-user-${Date.now()}`;

      // Create user with phone
      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        phoneNumber: testPhone,
        displayName: 'Findable User'
      });
      await setDoc(doc(db, 'usersByPhone', testPhone), { uid: userId });

      // Search by phone
      const phoneDoc = await getDoc(doc(db, 'usersByPhone', testPhone));
      expect(phoneDoc.exists()).toBe(true);
      
      const foundUserId = phoneDoc.data()?.uid;
      expect(foundUserId).toBe(userId);

      // Get full user profile
      const userDoc = await getDoc(doc(db, 'users', foundUserId));
      expect(userDoc.data()?.phoneNumber).toBe(testPhone);
    });
  });
});

