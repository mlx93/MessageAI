import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { getUserProfile } from '../../services/authService';
import { createOrGetConversation } from '../../services/conversationService';
import { useAuth } from '../../store/AuthContext';
import { formatPhoneNumber } from '../../utils/phoneFormat';
import Avatar from '../../components/Avatar';
import { User } from '../../types';

export default function ContactInfoScreen() {
  const { userId } = useLocalSearchParams();
  const { user: currentUser } = useAuth();
  const [contactUser, setContactUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const targetUserId = userId as string;
  const isOwnProfile = targetUserId === currentUser?.uid;

  useEffect(() => {
    loadUserProfile();
  }, [targetUserId]);

  const loadUserProfile = async () => {
    try {
      const profile = await getUserProfile(targetUserId);
      setContactUser(profile);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      Alert.alert('Error', 'Failed to load contact information');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentUser || !contactUser) return;

    setSendingMessage(true);
    try {
      const conversationId = await createOrGetConversation(
        [currentUser.uid, contactUser.uid],
        currentUser.uid
      );
      router.replace(`/chat/${conversationId}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleEditProfile = () => {
    router.push('/auth/edit-profile');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Contact Info',
            headerBackTitle: '',
          }}
        />
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!contactUser) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Contact Info',
            headerBackTitle: '',
          }}
        />
        <Text style={styles.errorText}>User not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: contactUser.displayName || 'Contact Info',
          headerBackTitle: '',
        }}
      />
      <View style={styles.content}>
        {/* Profile Picture */}
        <Avatar
          photoURL={contactUser.photoURL}
          initials={contactUser.initials}
          size={120}
          style={styles.avatar}
        />

        {/* Display Name */}
        <Text style={styles.displayName}>{contactUser.displayName}</Text>

        {/* Email */}
        {contactUser.email && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{contactUser.email}</Text>
          </View>
        )}

        {/* Phone Number */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>
            {formatPhoneNumber(contactUser.phoneNumber)}
          </Text>
        </View>

        {/* Action Button */}
        {isOwnProfile ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleEditProfile}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, sendingMessage && styles.buttonDisabled]}
            onPress={handleSendMessage}
            disabled={sendingMessage}
            activeOpacity={0.7}
          >
            {sendingMessage ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Send Message</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  loader: {
    marginTop: 100,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
    color: '#999',
  },
  avatar: {
    marginBottom: 20,
  },
  displayName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#000',
    marginBottom: 32,
    textAlign: 'center',
  },
  infoRow: {
    width: '100%',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  infoLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 17,
    color: '#000',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});

