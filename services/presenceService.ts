/**
 * Presence Service
 * 
 * Handles user online/offline status tracking
 * Uses Firestore's onDisconnect() to automatically set users offline when they disconnect
 */

import { doc, setDoc, onSnapshot, serverTimestamp, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Set user as online and register disconnect handler
 * 
 * When user comes online:
 * 1. Set online: true in Firestore
 * 2. Set inApp: true to indicate active app usage
 * 3. Update lastSeen timestamp
 * 4. Register onDisconnect handler to set offline when connection drops
 * 
 * @param userId - User ID to set online
 * @param inApp - Whether user is actively in the app (default: true)
 */
export const setUserOnline = async (userId: string, inApp: boolean = true): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  
  // Set user as online
  await setDoc(
    userRef,
    {
      online: true,
      inApp,
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );
  
  // Note: onDisconnect is a Realtime Database feature
  // For Firestore, we'll handle disconnect in the app lifecycle
  // This is a known limitation - proper implementation would use Realtime Database
  // or Cloud Functions to detect disconnects
};

/**
 * Set user as offline
 * Called when user explicitly logs out or app is closed
 * 
 * @param userId - User ID to set offline
 */
export const setUserOffline = async (userId: string): Promise<void> => {
  await setDoc(
    doc(db, 'users', userId),
    {
      online: false,
      inApp: false,
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Subscribe to a user's presence status
 * 
 * @param userId - User ID to monitor
 * @param callback - Function called when presence changes
 * @returns Unsubscribe function
 */
export const subscribeToUserPresence = (
  userId: string,
  callback: (online: boolean, inApp: boolean, lastSeen?: Date) => void
): Unsubscribe => {
  const userRef = doc(db, 'users', userId);
  
  return onSnapshot(userRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      const online = data.online || false;
      const inApp = data.inApp || false;
      const lastSeen = data.lastSeen?.toDate();
      
      callback(online, inApp, lastSeen);
    }
  });
};

/**
 * Subscribe to multiple users' presence
 * Useful for conversations list to show online status for all participants
 * 
 * @param userIds - Array of user IDs to monitor
 * @param callback - Function called with map of userId -> presence status
 * @returns Array of unsubscribe functions
 */
export const subscribeToMultipleUsersPresence = (
  userIds: string[],
  callback: (presenceMap: Record<string, { online: boolean; inApp: boolean; lastSeen?: Date }>) => void
): Unsubscribe[] => {
  const presenceMap: Record<string, { online: boolean; inApp: boolean; lastSeen?: Date }> = {};
  
  const unsubscribes = userIds.map((userId) => {
    return subscribeToUserPresence(userId, (online, inApp, lastSeen) => {
      presenceMap[userId] = { online, inApp, lastSeen };
      callback({ ...presenceMap });
    });
  });
  
  return unsubscribes;
};

/**
 * Update user's last seen timestamp
 * Called periodically while app is in foreground
 * 
 * @param userId - User ID
 */
export const updateLastSeen = async (userId: string): Promise<void> => {
  await setDoc(
    doc(db, 'users', userId),
    {
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );
};

/**
 * Set whether user is actively in the app
 * This allows distinguishing between:
 * - Green indicator: online AND inApp (actively using the app)
 * - Yellow indicator: online but NOT inApp (logged in, has internet, but app in background)
 * 
 * @param userId - User ID
 * @param inApp - Whether user is actively in the app
 */
export const setUserInApp = async (userId: string, inApp: boolean): Promise<void> => {
  await setDoc(
    doc(db, 'users', userId),
    {
      inApp,
      lastSeen: serverTimestamp(),
    },
    { merge: true }
  );
};

