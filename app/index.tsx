/**
 * Entry Point / Index Screen
 * 
 * Handles auth routing:
 * - Shows loading spinner while checking auth state
 * - Redirects to complete-profile if profile is incomplete
 * - Redirects to tabs if logged in with complete profile
 * - Redirects to login if not logged in
 */

import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../store/AuthContext';
import { isProfileComplete } from '../services/authService';

export default function IndexScreen() {
  const { user, userProfile, loading } = useAuth();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (!loading && !hasRedirectedRef.current) {
      if (user) {
        // User is authenticated, check if profile is complete
        if (isProfileComplete(userProfile)) {
          // Profile is complete, go to main app
          router.replace('/(tabs)');
        } else {
          // Profile is incomplete, go to profile completion
          console.log('Profile incomplete, redirecting to complete-profile');
          router.replace('/auth/complete-profile');
        }
      } else {
        // User is not authenticated, go to phone login (primary auth method)
        router.replace('/auth/phone-login');
      }
      hasRedirectedRef.current = true;
    }
  }, [user, userProfile, loading]);

  // Show loading spinner while checking auth state
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

