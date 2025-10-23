/**
 * Edit Profile Screen
 * 
 * Allows users to update their name and email
 */

import React, { useEffect, useState } from 'react';
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
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { updateUserProfile } from '../../services/authService';
import { useAuth } from '../../store/AuthContext';
import { formatPhoneNumber } from '../../utils/phoneFormat';
import { pickAndUploadProfilePicture } from '../../services/imageService';
import Avatar from '../../components/Avatar';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function EditProfileScreen() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.firstName || '');
      setLastName(userProfile.lastName || '');
      setEmail(userProfile.email || '');
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to edit your profile.');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'Please fill in first and last name.');
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile(user.uid, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
      });

      await refreshUserProfile();
      Alert.alert('Success', 'Profile updated successfully.');
      router.back();
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleUploadAvatar = async () => {
    if (!user) return;
    
    setIsUploadingAvatar(true);
    try {
      const photoURL = await pickAndUploadProfilePicture(user.uid);
      if (photoURL) {
        await updateUserProfile(user.uid, { photoURL });
        await refreshUserProfile();
      }
    } catch (error: any) {
      console.error('Failed to upload avatar:', error);
      Alert.alert('Error', 'Failed to upload profile picture');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeIn.duration(300)} style={styles.content}>
            <Text style={styles.title}>Edit Profile</Text>
            <Text style={styles.subtitle}>Update your account information</Text>

            {/* Profile Picture */}
            <TouchableOpacity 
              style={styles.avatarContainer} 
              onPress={handleUploadAvatar}
              disabled={isUploadingAvatar}
              activeOpacity={0.8}
            >
              <Avatar
                photoURL={userProfile?.photoURL}
                initials={userProfile?.initials || '??'}
                size={120}
              />
              {isUploadingAvatar && (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator color="#fff" size="large" />
                </View>
              )}
              <Text style={styles.avatarText}>Tap to change photo</Text>
            </TouchableOpacity>
            
            <Text style={styles.avatarHint}>Pinch to zoom when cropping for a closer shot</Text>

            <TouchableOpacity
              style={[styles.uploadPhotoButton, isUploadingAvatar && styles.buttonDisabled]}
              onPress={handleUploadAvatar}
              disabled={isUploadingAvatar}
              activeOpacity={0.8}
            >
              <Text style={styles.uploadPhotoText}>
                {isUploadingAvatar ? 'Uploading…' : 'Upload Profile Photo'}
              </Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="First Name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              editable={!loading}
              autoFocus={true}
            />

            <TextInput
              style={styles.input}
              placeholder="Last Name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              editable={!loading}
            />

            <TextInput
              style={[styles.input, !email && styles.inputPlaceholder]}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
              autoFocus={false}
            />

            <View style={styles.phoneContainer}>
              <TextInput
                style={[styles.input, styles.phoneInput]}
                value={userProfile?.phoneNumber ? formatPhoneNumber(userProfile.phoneNumber) : ''}
                editable={false}
              />
              <Text style={styles.phoneLabel}>Phone (unchangeable)</Text>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 24,
    alignItems: 'center',
  },
  avatarLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
  },
  avatarText: {
    marginTop: 8,
    fontSize: 14,
    color: '#007AFF',
  },
  avatarHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  uploadPhotoButton: {
    alignSelf: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  uploadPhotoText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  inputPlaceholder: {
    color: '#999',
  },
  phoneContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  phoneInput: {
    backgroundColor: '#f8f8f8',
    color: '#000',
    fontWeight: '500',
  },
  phoneLabel: {
    position: 'absolute',
    bottom: 20,
    right: 15,
    fontSize: 12,
    color: '#999',
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
  cancelButton: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});


