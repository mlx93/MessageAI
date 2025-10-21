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
import { db } from './firebase';

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
 * Note: For Expo Go (development), this works on both simulators and devices
 * For production builds, iOS requires a physical device
 * 
 * @param userId - User ID to associate with the FCM token
 * @returns Expo push token or null if failed/denied
 */
export const registerForPushNotifications = async (userId: string): Promise<string | null> => {
  try {
    // Check if device (not web)
    if (!Device.isDevice && Platform.OS !== 'ios' && Platform.OS !== 'android') {
      console.log('Push notifications not available on web');
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
      console.log('Push notification permission denied');
      return null;
    }
    
    // Get Expo push token
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Push token:', token);
    
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
  } catch (error) {
    console.error('Failed to register for push notifications:', error);
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
  try {
    await setDoc(doc(db, 'activeConversations', userId), {
      conversationId: conversationId || null,
      lastActive: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to set active conversation:', error);
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
 * Schedule a local notification (for testing)
 * 
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional data to attach to notification
 */
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  data?: any
): Promise<void> => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Show immediately
  });
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
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

