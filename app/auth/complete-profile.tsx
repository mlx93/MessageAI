/**
 * Complete Profile Screen
 * 
 * Allows users to add missing profile fields
 * Required for users who:
 * - Signed up before all fields were required
 * - Used social auth without phone number
 * - Have incomplete profiles
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../store/AuthContext';
import { updateUserProfile } from '../../services/authService';

export default function CompleteProfileScreen() {
  const { user, userProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pre-fill existing data
    if (userProfile) {
      setFirstName(userProfile.firstName || '');
      setLastName(userProfile.lastName || '');
      setPhoneNumber(userProfile.phoneNumber || '');
    }
  }, [userProfile]);

  const getMissingFields = () => {
    const missing: string[] = [];
    if (!firstName) missing.push('First Name');
    if (!lastName) missing.push('Last Name');
    if (!phoneNumber) missing.push('Phone Number');
    return missing;
  };

  const validatePhone = (phone: string): boolean => {
    const phoneDigits = phone.replace(/\D/g, '');
    return phoneDigits.length >= 10;
  };

  const handleSave = async () => {
    const missing = getMissingFields();
    
    if (missing.length > 0) {
      Alert.alert('Missing Information', `Please complete: ${missing.join(', ')}`);
      return;
    }

    if (!validatePhone(phoneNumber)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (at least 10 digits)');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setLoading(true);
    try {
      const updates = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        initials: `${firstName.trim()[0]}${lastName.trim()[0]}`.toUpperCase(),
      };

      await updateUserProfile(user.uid, updates);
      
      Alert.alert(
        'Profile Updated',
        'Your profile has been completed successfully!',
        [
          {
            text: 'Continue',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Profile update error:', error);
      Alert.alert('Update Failed', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const missingFields = getMissingFields();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            {missingFields.length > 0
              ? `Please add the following: ${missingFields.join(', ')}`
              : 'Update your profile information'}
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={[styles.input, !firstName && styles.inputMissing]}
              placeholder="Enter your first name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              editable={!loading}
            />

            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={[styles.input, !lastName && styles.inputMissing]}
              placeholder="Enter your last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              editable={!loading}
            />

            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={[styles.input, !phoneNumber && styles.inputMissing]}
              placeholder="Enter your phone number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              editable={!loading}
            />

            <Text style={styles.hint}>
              * Required fields. Phone format: (555) 123-4567 or +15551234567
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save Profile</Text>
            )}
          </TouchableOpacity>

          {userProfile?.firstName && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => router.replace('/(tabs)')}
              disabled={loading}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputMissing: {
    borderColor: '#FF9500',
    backgroundColor: '#FFF9F0',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 15,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
  },
  skipText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

