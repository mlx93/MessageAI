/**
 * Chats Screen (Main Tab)
 * 
 * Placeholder for conversations list
 * Shows welcome message and sign out button for now
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../store/AuthContext';

export default function ChatsScreen() {
  const { userProfile, signOut, user } = useAuth();

  // Debug logging
  React.useEffect(() => {
    console.log('ChatsScreen - user:', user?.uid);
    console.log('ChatsScreen - userProfile:', JSON.stringify(userProfile, null, 2));
  }, [userProfile, user]);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  // Show loading if profile isn't loaded yet
  if (!userProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Loading profile...</Text>
          <Text style={styles.info}>User ID: {user?.uid || 'Unknown'}</Text>
        </View>
      </View>
    );
  }

  const handleEditProfile = () => {
    router.push('/auth/complete-profile');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to MessageAI!</Text>
        <Text style={styles.subtitle}>
          Hello, {userProfile.firstName} {userProfile.lastName}!
        </Text>
        <Text style={styles.info}>Email: {userProfile.email}</Text>
        <Text style={styles.info}>Phone: {userProfile.phoneNumber}</Text>
        <Text style={styles.info}>UID: {userProfile.uid.substring(0, 8)}...</Text>
        <Text style={styles.status}>✅ Authentication Complete</Text>

        <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
    color: '#34C759',
    marginTop: 20,
    marginBottom: 40,
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

