/**
 * Notification Service
 * 
 * Handles push notifications using Expo notifications API
 * Registers FCM tokens and manages active conversation tracking
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

// Suppress console warnings for Android Expo Go limitations
const originalWarn = console.warn;
const originalError = console.error;

// Filter out known Expo Go Android notification warnings
console.warn = (...args) => {
  const message = args[0]?.toString() || '';
  if (
    message.includes('expo-notifications') &&
    message.includes('Expo Go') &&
    Platform.OS === 'android'
  ) {
    // Suppress Expo Go Android notification warnings
    return;
  }
  originalWarn.apply(console, args);
};

console.error = (...args) => {
  const message = args[0]?.toString() || '';
  if (
    message.includes('expo-notifications') &&
    (message.includes('Expo Go') || message.includes('development build')) &&
    Platform.OS === 'android'
  ) {
    // Suppress Expo Go Android notification errors - these are expected
    return;
  }
  originalError.apply(console, args);
};

/**
 * Configure notification handler
 * Determines how notifications are displayed when app is in foreground
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and save FCM token to Firestore
 * 
 * Note: Expo Go on Android (SDK 53+) doesn't support push notifications
 * Use a development build for full functionality
 * iOS Expo Go still works for push notifications
 * 
 * @param userId - User ID to associate with the FCM token
 * @returns Expo push token or null if failed/denied/unsupported
 */
export const registerForPushNotifications = async (userId: string): Promise<string | null> => {
  try {
    // Check if device (not web)
    if (!Device.isDevice && Platform.OS !== 'ios' && Platform.OS !== 'android') {
      if (__DEV__) {
        console.log('📱 Push notifications not available on web');
      }
      return null;
    }

    // Expo Go limitation: Android doesn't support push notifications (SDK 53+)
    if (Platform.OS === 'android') {
      if (__DEV__) {
        console.log(
          '📱 [Android] Push notifications disabled in Expo Go.\n' +
          '   ℹ️  To enable: create a development build with `npx expo run:android`\n' +
          '   ℹ️  App works perfectly without notifications in development!'
        );
      }
      return null;
    }

    // Get existing permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // Request permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('📱 Push notification permission denied');
      return null;
    }
    
    // Get Expo push token
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('📱 Push token registered:', token);
    
    // Save token to Firestore
    await setDoc(
      doc(db, 'users', userId),
      {
        fcmToken: token,
        tokenUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    
    return token;
  } catch (error: any) {
    // Gracefully handle Expo Go limitations
    if (error.message && error.message.includes('projectId')) {
      console.log('📱 Push notifications not supported in Expo Go - app will work without them');
    } else {
      console.error('📱 Failed to register for push notifications:', error.message || error);
    }
    return null;
  }
};

/**
 * Set the active conversation for a user
 * Used by Cloud Functions to determine whether to send a notification
 * If user is actively viewing a conversation, no notification is sent
 * 
 * @param userId - User ID
 * @param conversationId - ID of the conversation user is viewing, or null if none
 */
export const setActiveConversation = async (
  userId: string,
  conversationId: string | null
): Promise<void> => {
  if (!userId) {
    console.warn('Cannot set active conversation: userId is undefined');
    return;
  }
  
  // Check if user is still authenticated before making Firestore calls
  if (!auth.currentUser) {
    console.warn('Cannot set active conversation: user is not authenticated');
    return;
  }
  
  try {
    // Use a timeout to prevent hanging on permission issues
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 3000);
    });
    
    const setDocPromise = setDoc(doc(db, 'activeConversations', userId), {
      conversationId: conversationId || null,
      lastActive: serverTimestamp(),
    });
    
    await Promise.race([setDocPromise, timeoutPromise]);
  } catch (error: any) {
    // Silently fail for permission errors - not critical for app functionality
    if (error?.code === 'permission-denied' || error?.message === 'Timeout') {
      console.warn('⚠️ Permission denied or timeout for activeConversations (non-critical)');
    } else {
      console.error('Failed to set active conversation:', error);
    }
  }
};

/**
 * Add notification received listener
 * Called when a notification is received while app is in foreground
 * 
 * @param callback - Function to call when notification is received
 * @returns Subscription object with remove() method
 */
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
) => {
  return Notifications.addNotificationReceivedListener(callback);
};

/**
 * Add notification response listener
 * Called when user taps on a notification
 * 
 * @param callback - Function to call when notification is tapped
 * @returns Subscription object with remove() method
 */
export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Schedule a local notification
 * Used for background notifications when app is not in foreground
 * 
 * @param title - Notification title (sender name)
 * @param body - Notification body (message text)
 * @param data - Optional data to attach to notification (conversationId, etc.)
 */
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  data?: any
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Show immediately
    });
    console.log(`📬 Local notification scheduled: ${title}`);
  } catch (error) {
    console.error('Failed to schedule local notification:', error);
    throw error;
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * Dismiss all delivered notifications
 * Useful for clearing stale notifications when user logs in
 * Also cancels any scheduled notifications
 */
export const dismissAllDeliveredNotifications = async (): Promise<void> => {
  try {
    // Clear delivered notifications (in notification center)
    await Notifications.dismissAllNotificationsAsync();
    // Also cancel any scheduled/pending notifications
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('🧹 Cleared all delivered and scheduled notifications');
  } catch (error) {
    console.error('Failed to dismiss notifications:', error);
  }
};

/**
 * Get notification permission status
 * 
 * @returns Permission status: 'granted', 'denied', or 'undetermined'
 */
export const getNotificationPermissionStatus = async (): Promise<string> => {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
};

