/**
 * Root Layout
 * 
 * Wraps the app with AuthProvider and configures navigation structure
 * Initializes SQLite, offline queue processing, and push notifications
 */

import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { AuthProvider, useAuth } from '../store/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDB } from '../services/sqliteService';
import { processQueue } from '../services/offlineQueue';
import { 
  registerForPushNotifications, 
  addNotificationResponseListener 
} from '../services/notificationService';
import NetInfo from '@react-native-community/netinfo';

function AppContent() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Initialize SQLite database
    initDB().catch(error => {
      console.error('Failed to initialize SQLite:', error);
    });
    
    // Process offline queue when network reconnects
    const unsubscribeNet = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue().catch(error => {
          console.error('Failed to process offline queue:', error);
        });
      }
    });
    
    // Register for push notifications when user is authenticated
    if (user) {
      registerForPushNotifications(user.uid).catch(error => {
        console.error('Failed to register for push notifications:', error);
      });
    }
    
    // Handle notification taps
    const unsubscribeNotifications = addNotificationResponseListener((response) => {
      const conversationId = response.notification.request.content.data?.conversationId;
      if (conversationId) {
        // Navigate to the conversation
        router.push(`/chat/${conversationId}`);
      }
    });
    
    return () => {
      unsubscribeNet();
      unsubscribeNotifications.remove();
    };
  }, [user]);

  return (
    <Stack screenOptions={{ 
      headerShown: false,
      headerBackTitleVisible: false,
      headerTintColor: '#007AFF',
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />
      <Stack.Screen name="auth/phone-login" />
      <Stack.Screen name="auth/verify-otp" />
      <Stack.Screen name="auth/setup-profile" />
      <Stack.Screen name="auth/edit-profile" />
      <Stack.Screen name="auth/complete-profile" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen 
        name="contacts/import" 
        options={{ 
          headerShown: true,
          title: 'Import Contacts',
          headerBackTitleVisible: false,
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="chat/[id]" 
        options={{ 
          headerShown: true,
          title: '',
          headerBackTitleVisible: false,
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="new-message" 
        options={{ 
          headerShown: true,
          title: 'New Message',
          headerBackTitleVisible: false,
          presentation: 'card',
        }} 
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

