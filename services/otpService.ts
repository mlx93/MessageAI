/**
 * OTP Service
 * 
 * Automatically fetches OTP codes from Firestore for development/testing
 * Provides better UX than manual terminal commands
 */

import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Alert, Clipboard } from 'react-native';

/**
 * Wait for OTP code to be generated and fetch it from Firestore
 * This polls the verification document for the code
 * 
 * @param verificationId - Verification document ID
 * @param phoneNumber - Phone number for display
 * @param onCodeReady - Callback when code is ready
 * @returns Unsubscribe function
 */
export const waitForOTPCode = (
  verificationId: string,
  phoneNumber: string,
  onCodeReady: (code: string) => void
): (() => void) => {
  console.log(`📱 Waiting for OTP code for verification: ${verificationId}`);

  // Listen to the verification document in real-time
  const unsubscribe = onSnapshot(
    doc(db, 'verifications', verificationId),
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.code) {
          console.log(`✅ OTP code received: ${data.code}`);
          onCodeReady(data.code);
        }
      }
    },
    (error) => {
      console.error('Error listening for OTP:', error);
    }
  );

  return unsubscribe;
};

/**
 * Fetch OTP code from Firestore (one-time read)
 * Use this if you don't need real-time updates
 * 
 * @param verificationId - Verification document ID
 * @returns OTP code or null if not found
 */
export const fetchOTPCode = async (
  verificationId: string
): Promise<string | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'verifications', verificationId));
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.code || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching OTP:', error);
    return null;
  }
};

/**
 * Show OTP code with copy functionality
 * Provides better UX than terminal commands
 * 
 * @param code - The 6-digit OTP code
 * @param phoneNumber - Phone number for context (formatted)
 */
export const showOTPWithCopy = (code: string, phoneNumber: string) => {
  Alert.alert(
    '📱 Your Verification Code',
    `Code for ${phoneNumber}:\n\n${code}`,
    [
      {
        text: 'Copy Code',
        onPress: async () => {
          await Clipboard.setString(code);
          // No confirmation alert - just copy silently
        },
      },
      {
        text: 'Enter Manually',
        style: 'cancel',
      },
    ]
  );
};

/**
 * Auto-fetch and display OTP code
 * Complete workflow: wait → fetch → show → copy
 * 
 * @param verificationId - Verification document ID
 * @param phoneNumber - Phone number (formatted for display)
 * @param onCodeDisplayed - Optional callback when code is displayed
 */
export const autoFetchAndShowOTP = (
  verificationId: string,
  phoneNumber: string,
  onCodeDisplayed?: (code: string) => void
): (() => void) => {
  // Show loading indicator
  console.log(`🔄 Auto-fetching OTP for ${phoneNumber}...`);

  const unsubscribe = waitForOTPCode(verificationId, phoneNumber, (code) => {
    // Code is ready - show it with copy option
    showOTPWithCopy(code, phoneNumber);
    
    if (onCodeDisplayed) {
      onCodeDisplayed(code);
    }
    
    // Clean up listener after code is displayed
    unsubscribe();
  });

  return unsubscribe;
};

/**
 * Check if this is a test number (always has code 123456)
 */
export const isTestNumber = (phoneNumber: string): boolean => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  return cleaned.startsWith('1650555') || cleaned.startsWith('650555');
};

