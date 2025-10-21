/**
 * Phone Prompt Modal
 * 
 * Modal that appears after social auth (Google/Apple) to collect phone number
 * Required for users who sign in via OAuth providers that don't provide phone
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { updateUserProfile, normalizePhoneNumber } from '../services/authService';

interface PhonePromptModalProps {
  visible: boolean;
  userId: string;
  onComplete: () => void;
  onCancel?: () => void;
}

export default function PhonePromptModal({
  visible,
  userId,
  onComplete,
  onCancel,
}: PhonePromptModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePhone = (phone: string): boolean => {
    const phoneDigits = phone.replace(/\D/g, '');
    return phoneDigits.length >= 10;
  };

  const handleSubmit = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Required', 'Please enter your phone number');
      return;
    }

    if (!validatePhone(phoneNumber)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (at least 10 digits)');
      return;
    }

    setLoading(true);
    try {
      const normalized = normalizePhoneNumber(phoneNumber);
      await updateUserProfile(userId, {
        phoneNumber: normalized,
      });
      
      Alert.alert('Success', 'Phone number saved!', [
        {
          text: 'Continue',
          onPress: onComplete,
        },
      ]);
    } catch (error: any) {
      console.error('Phone update error:', error);
      Alert.alert('Error', error.message || 'Failed to save phone number');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      Alert.alert(
        'Phone Number Required',
        'A phone number is required to use this app. You can add it later in your profile settings.',
        [
          {
            text: 'Add Now',
            style: 'default',
          },
          {
            text: 'Add Later',
            style: 'cancel',
            onPress: onCancel,
          },
        ]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.title}>One More Step</Text>
          <Text style={styles.subtitle}>
            Please enter your phone number to complete your profile
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="(555) 123-4567 or +15551234567"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoFocus
              editable={!loading}
            />
            <Text style={styles.hint}>
              Format: (555) 123-4567 or +1 555 123 4567
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>

          {onCancel && !loading && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: '#666',
    fontSize: 14,
  },
});

