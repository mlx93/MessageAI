/**
 * Auth Context
 * 
 * Provides authentication state and user profile throughout the app
 * Listens to Firebase Auth state changes and syncs with Firestore user profile
 * Manages presence status (online/offline)
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { AppState, AppStateStatus } from 'react-native';
import { auth } from '../services/firebase';
import { getUserProfile } from '../services/authService';
import { setUserOnline, setUserOffline, setUserInApp, updateLastSeen } from '../services/presenceService';
import { flushCacheBuffer } from '../services/sqliteService';
import { User } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  refreshUserProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const refreshUserProfile = React.useCallback(async () => {
    if (!auth.currentUser) {
      setUserProfile(null);
      return;
    }

    try {
      console.log('Refreshing user profile...');
      const profile = await getUserProfile(auth.currentUser.uid);
      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
    }
  }, []);

  // Start heartbeat to update lastSeen every 15 seconds
  const startHeartbeat = React.useCallback((userId: string) => {
    // Clear any existing heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Update lastSeen every 15 seconds while app is active
    heartbeatIntervalRef.current = setInterval(async () => {
      if (auth.currentUser) {
        await updateLastSeen(auth.currentUser.uid);
      }
    }, 15000); // 15 seconds
  }, []);

  // Stop heartbeat when app backgrounds or user logs out
  const stopHeartbeat = React.useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? firebaseUser.uid : 'null');
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Load user profile from Firestore
        console.log('Loading user profile...');
        const profile = await getUserProfile(firebaseUser.uid);
        console.log('Profile loaded:', profile?.displayName);
        setUserProfile(profile);
        
        // Set user as online and in app
        try {
          await setUserOnline(firebaseUser.uid, true);
          console.log('User set to online and in app');
        } catch (error) {
          console.error('Failed to set user online:', error);
        }

        // Start heartbeat to keep presence fresh
        startHeartbeat(firebaseUser.uid);
      } else {
        setUserProfile(null);
        // Stop heartbeat on logout
        stopHeartbeat();
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      // Clean up heartbeat on unmount
      stopHeartbeat();
    };
  }, [startHeartbeat, stopHeartbeat]);

  // Monitor app state to update inApp status and heartbeat
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (!auth.currentUser) return;

      console.log('App state changed:', nextAppState);

      if (nextAppState === 'active') {
        // App is in foreground
        try {
          await setUserInApp(auth.currentUser.uid, true);
          console.log('User set to inApp: true');
          // Resume heartbeat when app comes to foreground
          startHeartbeat(auth.currentUser.uid);
        } catch (error) {
          console.error('Failed to set user inApp:', error);
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App is in background or inactive
        try {
          await setUserInApp(auth.currentUser.uid, false);
          if (__DEV__) console.log('User set to inApp: false');
          // Stop heartbeat when app goes to background
          stopHeartbeat();
          // Flush any pending cache writes
          await flushCacheBuffer();
          if (__DEV__) console.log('💾 Cache flushed on background');
        } catch (error) {
          console.error('Failed to set user inApp or flush cache:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [startHeartbeat, stopHeartbeat]);

  const handleSignOut = async () => {
    try {
      // Stop heartbeat before signing out
      stopHeartbeat();
      
      // Set user offline before signing out
      if (auth.currentUser) {
        await setUserOffline(auth.currentUser.uid);
        console.log('User set to offline');
      }
      
      const { signOut } = await import('../services/authService');
      console.log('Signing out...');
      await signOut();
      console.log('Sign out successful');
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        refreshUserProfile,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to access auth context
 * Must be used within AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

