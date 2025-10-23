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
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { updateUserProfile } from '../../services/authService';
import { useAuth } from '../../store/AuthContext';
import { formatPhoneNumber } from '../../utils/phoneFormat';
import { uploadProfilePicture } from '../../services/imageService';

export default function EditProfileScreen() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

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

  const handleUploadPhoto = async () => {
    if (!user) return;
    
    setIsUploadingPhoto(true);
    try {
      const photoURL = await uploadProfilePicture(user.uid);
      if (photoURL) {
        await updateUserProfile(user.uid, { photoURL });
        await refreshUserProfile();
        Alert.alert('Success', 'Profile picture updated');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload profile picture');
    } finally {
      setIsUploadingPhoto(false);
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
          <View style={styles.content}>
            <Text style={styles.title}>Edit Profile</Text>
            <Text style={styles.subtitle}>Update your account information</Text>

            {/* Profile Photo Section */}
            <View style={styles.photoSection}>
              <TouchableOpacity 
                onPress={handleUploadPhoto}
                disabled={isUploadingPhoto || loading}
              >
                <View style={styles.avatarLarge}>
                  {userProfile?.photoURL ? (
                    <Image source={{ uri: userProfile.photoURL }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>{userProfile?.initials}</Text>
                  )}
                  {isUploadingPhoto && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="large" color="#007AFF" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleUploadPhoto} 
                disabled={isUploadingPhoto || loading}
              >
                <Text style={styles.changePhotoText}>
                  {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="First Name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              editable={!loading}
              autoFocus={false}
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
          </View>
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
  photoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '600',
    color: '#FFF',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});


