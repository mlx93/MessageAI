/**
 * Development OTP Helper
 * 
 * This service helps developers get OTP codes during testing
 * ONLY works in development mode - not available in production
 */

import { Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const isDevelopment = __DEV__;

/**
 * Show instructions for getting OTP code
 * In development, provides helpful instructions and commands
 */
export const showOtpInstructions = async (phoneNumber: string) => {
  if (!isDevelopment) {
    console.log('OTP helper only available in development');
    return;
  }

  const command = 'firebase functions:log --only sendPhoneVerificationCode --lines 5 | grep "Generated OTP"';
  
  Alert.alert(
    '🔧 Development Mode',
    `To get your OTP code:\n\n1. Open a terminal\n2. Run this command:\n\n${command}\n\n3. Look for your code next to ${phoneNumber}`,
    [
      {
        text: 'Copy Command',
        onPress: async () => {
          await Clipboard.setStringAsync(command);
          Alert.alert('✅ Copied!', 'Paste in your terminal to get the OTP code');
        },
      },
      {
        text: 'OK',
        style: 'cancel',
      },
    ]
  );
};

/**
 * Show a local notification with OTP code (for development)
 * This would be called after manually checking Firebase logs
 */
export const showOtpNotification = async (otpCode: string) => {
  if (!isDevelopment) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📱 Your OTP Code',
        body: `Code: ${otpCode}`,
        data: { otpCode },
        sound: true,
      },
      trigger: null, // Show immediately
    });

    // Also copy to clipboard automatically
    await Clipboard.setStringAsync(otpCode);
  } catch (error) {
    console.error('Failed to show OTP notification:', error);
  }
};

/**
 * Test if we're using a test phone number that has a static OTP
 * Test numbers: +1 650-555-xxxx always use code 123456
 */
export const getTestNumberOtp = (phoneNumber: string): string | null => {
  if (!phoneNumber) return null;
  
  // Clean phone number
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Check if it's a test number (650-555-xxxx)
  if (cleaned.startsWith('1650555') || cleaned.startsWith('650555')) {
    return '123456';
  }
  
  return null;
};

/**
 * Check if automatic OTP detection is available
 * This would require a backend service, which we're not implementing for security
 */
export const isAutoOtpAvailable = (): boolean => {
  return false; // Not available for security reasons
};

/**
 * Show helpful dev toast for OTP testing
 */
export const showDevHelper = async (phoneNumber: string) => {
  if (!isDevelopment) return;

  // Check if it's a test number first
  const testOtp = getTestNumberOtp(phoneNumber);
  if (testOtp) {
    Alert.alert(
      '🎯 Test Number Detected',
      `This is a test number!\n\nYour code is always: ${testOtp}`,
      [
        {
          text: 'Copy Code',
          onPress: async () => {
            await Clipboard.setStringAsync(testOtp);
            Alert.alert('✅ Copied!', 'Code copied to clipboard');
          },
        },
        {
          text: 'OK',
          style: 'cancel',
        },
      ]
    );
  } else {
    // Real number - show instructions
    await showOtpInstructions(phoneNumber);
  }
};

