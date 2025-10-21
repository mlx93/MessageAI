/**
 * Auth Context
 * 
 * Provides authentication state and user profile throughout the app
 * Listens to Firebase Auth state changes and syncs with Firestore user profile
 * Manages presence status (online/offline)
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserProfile } from '../services/authService';
import { setUserOnline, setUserOffline } from '../services/presenceService';
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
        
        // Set user as online
        try {
          await setUserOnline(firebaseUser.uid);
          console.log('User set to online');
        } catch (error) {
          console.error('Failed to set user online:', error);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    try {
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

