/**
 * Root Layout
 * 
 * Wraps the app with AuthProvider and configures navigation structure
 * Initializes SQLite and offline queue processing
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../store/AuthContext';
import { initDB } from '../services/sqliteService';
import { processQueue } from '../services/offlineQueue';
import NetInfo from '@react-native-community/netinfo';

export default function RootLayout() {
  useEffect(() => {
    // Initialize SQLite database
    initDB().catch(error => {
      console.error('Failed to initialize SQLite:', error);
    });
    
    // Process offline queue when network reconnects
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue().catch(error => {
          console.error('Failed to process offline queue:', error);
        });
      }
    });
    
    return unsubscribe;
  }, []);

  return (
    <AuthProvider>
      <Stack screenOptions={{ 
        headerShown: false,
        headerBackTitleVisible: false,
        headerTintColor: '#007AFF',
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
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
    </AuthProvider>
  );
}

