/**
 * OTP Verification Screen
 * 
 * Second step in phone authentication flow
 * User enters the 6-digit code received via SMS
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { verifyPhoneCode, getUserProfile } from '../../services/authService';
import { formatPhoneNumber } from '../../utils/phoneFormat';
import { autoFetchAndShowOTP, isTestNumber } from '../../services/otpService';

export default function VerifyOTPScreen() {
  const { verificationId, phoneNumber } = useLocalSearchParams<{
    verificationId: string;
    phoneNumber: string;
  }>();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [fetchingCode, setFetchingCode] = useState(false);
  
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Auto-fetch OTP code from Firestore (for development/testing)
  useEffect(() => {
    if (!verificationId || !phoneNumber) return;

    // Start fetching after a short delay to let the Cloud Function execute
    const timer = setTimeout(() => {
      setFetchingCode(true);
      console.log('🔄 Starting auto-fetch for OTP code...');
      
      const unsubscribe = autoFetchAndShowOTP(
        verificationId,
        formatPhoneNumber(phoneNumber),
        (fetchedCode) => {
          console.log('✅ Code auto-fetched:', fetchedCode);
          setFetchingCode(false);
        }
      );

      return () => {
        unsubscribe();
        setFetchingCode(false);
      };
    }, 2000); // Wait 2 seconds for Cloud Function to execute

    return () => clearTimeout(timer);
  }, [verificationId, phoneNumber]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleCodeChange = (text: string, index: number) => {
    // Handle paste of full 6-digit code
    if (text.length === 6 && /^\d{6}$/.test(text)) {
      const newCode = text.split('');
      setCode(newCode);
      // Auto-verify pasted code
      handleVerify(text);
      return;
    }

    // Only allow numbers for single digit
    if (text && !/^\d$/.test(text)) return;

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-advance to next input
    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits entered
    if (text && index === 5 && newCode.every(d => d !== '')) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (codeString?: string) => {
    const codeToVerify = codeString || code.join('');
    
    if (codeToVerify.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      // Verify the OTP code
      const userId = await verifyPhoneCode(verificationId, codeToVerify);
      
      // Get user profile to check if it's complete
      const userProfile = await getUserProfile(userId);
      
      // Check if profile is complete (has displayName)
      const isProfileComplete = userProfile && 
        userProfile.displayName && 
        userProfile.displayName.trim().length > 0;
      
      if (isProfileComplete) {
        // Existing user with complete profile - go to app
        router.replace('/(tabs)');
      } else {
        // New user or incomplete profile - need to setup profile
        router.replace({
          pathname: '/auth/setup-profile',
          params: { 
            userId,
            phoneNumber
          }
        });
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      Alert.alert(
        'Invalid Code',
        'The code you entered is incorrect. Please try again.'
      );
      // Clear the code
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setResending(true);
    try {
      const { sendPhoneVerificationCode } = await import('../../services/authService');
      await sendPhoneVerificationCode(phoneNumber);
      setCountdown(60);
      Alert.alert('Code Sent', 'A new verification code has been sent');
    } catch (error) {
      Alert.alert('Error', 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Enter Code</Text>
        <Text style={styles.subtitle}>
          We sent a code to{'\n'}
          {formatPhoneNumber(phoneNumber)}
        </Text>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => inputRefs.current[index] = ref}
              style={[
                styles.codeInput,
                digit !== '' && styles.codeInputFilled
              ]}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
              contextMenuHidden={false}
            />
          ))}
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Verifying...</Text>
          </View>
        )}

        {fetchingCode && !loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.helpText}>Fetching your code...</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.resendButton, (countdown > 0 || resending) && styles.resendButtonDisabled]}
          onPress={handleResend}
          disabled={countdown > 0 || resending}
        >
          {resending ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
              {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.changeNumberButton}
          onPress={() => router.back()}
        >
          <Text style={styles.changeNumberText}>Change phone number</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 24,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000',
    backgroundColor: '#F8F8F8',
  },
  codeInputFilled: {
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  resendButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: '#999',
  },
  changeNumberButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  changeNumberText: {
    fontSize: 16,
    color: '#666',
  },
  helpText: {
    marginTop: 8,
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'center',
  },
});

