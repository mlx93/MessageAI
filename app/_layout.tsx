/**
 * Root Layout
 * 
 * Wraps the app with AuthProvider and configures navigation structure
 */

import { Stack } from 'expo-router';
import { AuthProvider } from '../store/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/complete-profile" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}

