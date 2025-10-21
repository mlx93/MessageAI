/**
 * Profile Setup Screen
 * 
 * Final step for new users in phone authentication flow
 * User enters their display name and optional email
 */

import { useState, useEffect } from 'react';
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
import { createUserProfileWithPhone } from '../../services/authService';
import { useAuth } from '../../store/AuthContext';

export default function SetupProfileScreen() {
  const { userId, phoneNumber } = useLocalSearchParams<{
    userId: string;
    phoneNumber: string;
  }>();
  const { refreshUserProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Pre-populate fields if user has existing data
  useEffect(() => {
    const loadExistingProfile = async () => {
      if (!userId) return;
      
      try {
        const { getUserProfile } = await import('../../services/authService');
        const profile = await getUserProfile(userId);
        
        if (profile) {
          // Pre-populate from existing profile
          if (profile.firstName) setFirstName(profile.firstName);
          if (profile.lastName) setLastName(profile.lastName);
          if (profile.email) setEmail(profile.email);
          
          // If profile is complete, skip to app
          if (profile.displayName && profile.displayName.trim().length > 0) {
            console.log('Profile already complete, redirecting to app');
            router.replace('/(tabs)');
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load existing profile:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadExistingProfile();
  }, [userId]);

  const handleContinue = async () => {
    if (!firstName.trim()) {
      Alert.alert('First Name Required', 'Please enter your first name');
      return;
    }

    if (!lastName.trim()) {
      Alert.alert('Last Name Required', 'Please enter your last name');
      return;
    }

    // Optional: validate email if provided
    if (email && !isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      // Combine first and last name for displayName
      const displayName = `${firstName.trim()} ${lastName.trim()}`;
      
      console.log('Creating profile with:', { firstName, lastName, displayName, email });
      
      await createUserProfileWithPhone(
        userId,
        phoneNumber,
        displayName,
        email.trim() || undefined,
        firstName.trim(),
        lastName.trim()
      );

      console.log('Profile created successfully, refreshing...');
      
      // Refresh the AuthContext to load the new profile
      await refreshUserProfile();
      
      console.log('Profile refreshed, navigating to app');

      // Navigate to app
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Profile setup error:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to create profile. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Show loading while checking existing profile
  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to aiMessage</Text>
        <Text style={styles.subtitle}>Tell us about yourself</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="John"
              placeholderTextColor="#999"
              autoFocus
              autoCapitalize="words"
              maxLength={50}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Smith"
              placeholderTextColor="#999"
              autoCapitalize="words"
              maxLength={50}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email (Optional)</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="john@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>
              For account recovery
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading || !firstName.trim() || !lastName.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Your phone number won't be shared with other users
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
  },
  form: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#F8F8F8',
  },
  helperText: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#C0C0C0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
});

