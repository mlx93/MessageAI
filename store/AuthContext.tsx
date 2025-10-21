/**
 * Auth Context
 * 
 * Provides authentication state and user profile throughout the app
 * Listens to Firebase Auth state changes and syncs with Firestore user profile
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUserProfile } from '../services/authService';
import { User } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    const { signOut } = await import('../services/authService');
    await signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
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

