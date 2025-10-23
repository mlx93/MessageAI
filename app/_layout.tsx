/**
 * Root Layout
 * 
 * Wraps the app with AuthProvider and configures navigation structure
 * Initializes SQLite, offline queue processing, and push notifications
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from '../store/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initDB } from '../services/sqliteService';
import { processQueue } from '../services/offlineQueue';
import { 
  registerForPushNotifications, 
  addNotificationResponseListener,
  dismissAllDeliveredNotifications
} from '../services/notificationService';
import { 
  subscribeToAllConversations, 
  registerInAppNotificationCallback,
  markOffline 
} from '../services/globalMessageListener';
import InAppNotificationBanner from '../components/InAppNotificationBanner';
import NetworkStatusBanner from '../components/NetworkStatusBanner';
import NetInfo from '@react-native-community/netinfo';

function AppContent() {
  const router = useRouter();
  const { user } = useAuth();
  const wasOffline = useRef(false);
  const [inAppNotification, setInAppNotification] = useState<{
    id: string;
    conversationId: string;
    senderName: string;
    messageText: string;
    senderInitials: string;
    timestamp: number;
  } | null>(null);

  // Clear all notifications on app launch and every time app comes to foreground
  useEffect(() => {
    console.log('🧹 Clearing stale notifications on app launch');
    dismissAllDeliveredNotifications().catch(error => {
      console.error('Failed to dismiss notifications on launch:', error);
    });

    // Also clear notifications every time app comes to foreground
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('🧹 App became active - clearing stale notifications');
        dismissAllDeliveredNotifications().catch(error => {
          console.error('Failed to dismiss notifications on foreground:', error);
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    // Initialize SQLite database
    initDB().catch(error => {
      console.error('Failed to initialize SQLite:', error);
    });
    
    // Process offline queue when network reconnects
    const unsubscribeNet = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && wasOffline.current) {
        // Just reconnected
        console.log('🌐 Reconnected - processing queue...');
        
        try {
          const { sent, failed } = await processQueue();
          
          if (sent > 0) {
            Alert.alert(
              'Back Online',
              `${sent} message${sent === 1 ? '' : 's'} sent successfully`,
              [{ text: 'OK' }]
            );
          }
          
          if (failed > 0) {
            console.log(`⚠️ ${failed} message${failed === 1 ? '' : 's'} failed to send`);
          }
        } catch (error) {
          console.error('Failed to process offline queue:', error);
        }
        
        wasOffline.current = false;
      } else if (!state.isConnected) {
        // Mark as offline for catch-up notifications
        if (user) {
          markOffline(user.uid);
        }
        wasOffline.current = true;
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

  // Global message listener for all conversations
  useEffect(() => {
    if (!user) return;

    console.log('🔔 Setting up global message listener');

    // Register callback for in-app notifications
    registerInAppNotificationCallback((conversationId, senderName, messageText, senderInitials) => {
      setInAppNotification({
        id: `${conversationId}_${Date.now()}`,
        conversationId,
        senderName,
        messageText,
        senderInitials,
        timestamp: Date.now(),
      });
    });

    // Subscribe to all conversations
    const unsubscribe = subscribeToAllConversations(user.uid);

    return () => {
      console.log('🔕 Cleaning up global message listener');
      unsubscribe();
    };
  }, [user]);

  return (
    <>
      {/* Network status banner - shown at the very top when offline */}
      <NetworkStatusBanner />
      
      {/* In-app notification banner */}
      <InAppNotificationBanner 
        notification={inAppNotification}
        onDismiss={() => setInAppNotification(null)}
      />
      
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
      <Stack.Screen 
        name="auth/edit-profile"
        options={({ navigation }) => ({
          headerShown: true,
          title: 'Edit Profile',
          headerBackTitleVisible: false,
          headerBackTitle: '',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                marginLeft: 0,
                paddingLeft: 12,
                paddingRight: 12,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
            >
              <Ionicons name="chevron-back" size={30} color="#007AFF" />
            </TouchableOpacity>
          ),
        })}
      />
      {/* DEPRECATED: complete-profile removed - setup-profile handles all profile completion */}
      <Stack.Screen 
        name="(tabs)" 
        options={{
          headerShown: false,
          title: 'Messages',
          headerBackTitleVisible: false,
          headerBackTitle: '',
        }}
      />
      <Stack.Screen 
        name="contacts/import" 
        options={{ 
          headerShown: true,
          title: 'Import Contacts',
          headerBackTitleVisible: false,
          headerBackTitle: '',
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="chat/[id]" 
        options={({ navigation }) => ({ 
          headerShown: true,
          title: '',
          headerBackTitleVisible: false,
          headerBackTitle: '',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={{ 
                marginLeft: 0, 
                paddingLeft: 12,
                paddingRight: 12,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
            >
              <Ionicons name="chevron-back" size={30} color="#007AFF" />
            </TouchableOpacity>
          ),
          presentation: 'card',
          gestureEnabled: true,
          animation: 'slide_from_right',
          // Force full gesture handler reset on unmount
          animationTypeForReplace: 'push',
        })} 
      />
      <Stack.Screen 
        name="new-message" 
        options={{ 
          headerShown: true,
          title: 'New Message',
          headerBackTitleVisible: false,
          headerBackTitle: '',
          presentation: 'card',
        }} 
      />
      <Stack.Screen
        name="group/[id]"
        options={({ navigation }) => ({
          headerShown: true,
          title: 'Group Info',
          headerBackTitleVisible: false,
          headerBackTitle: '',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                marginLeft: 0,
                paddingLeft: 12,
                paddingRight: 12,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
            >
              <Ionicons name="chevron-back" size={30} color="#007AFF" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="contact/[userId]"
        options={({ navigation }) => ({
          headerShown: true,
          title: 'Contact Info',
          headerBackTitleVisible: false,
          headerBackTitle: '',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{
                marginLeft: 0,
                paddingLeft: 12,
                paddingRight: 12,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
            >
              <Ionicons name="chevron-back" size={30} color="#007AFF" />
            </TouchableOpacity>
          ),
        })}
      />
    </Stack>
    </>
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

