/**
 * Login Screen
 * 
 * Allows users to sign in with email and password
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { signIn, signInWithGoogle, signInWithApple } from '../../services/authService';
import PhonePromptModal from '../../components/PhonePromptModal';
import { useAuth } from '../../store/AuthContext';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [pendingUserId, setPendingUserId] = useState('');
  const { user } = useAuth();

  // Google Sign-In configuration
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: '290630072291-c5m9hc72nk0lvh6g9j9mfvb6fqjb0h8v.apps.googleusercontent.com',
    androidClientId: '290630072291-8rfm0qk3vn9f4d0q5h5v8j5v8j5v8j5v.apps.googleusercontent.com',
    webClientId: '290630072291-c5m9hc72nk0lvh6g9j9mfvb6fqjb0h8v.apps.googleusercontent.com',
  });

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.idToken) {
        handleGoogleSignIn(authentication.idToken);
      }
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      console.log('Attempting sign in...');
      const user = await signIn(email, password);
      console.log('Sign in successful, user:', user.uid);
      // Navigation will happen automatically via AuthContext
      // Give a moment for auth state to update
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Login Failed', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (idToken: string) => {
    setLoading(true);
    try {
      console.log('Signing in with Google...');
      await signInWithGoogle(idToken);
      console.log('Google sign-in successful');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      if (error.message === 'PHONE_REQUIRED') {
        // Show phone prompt modal
        if (user?.uid) {
          setPendingUserId(user.uid);
          setPhoneModalVisible(true);
        }
      } else {
        Alert.alert('Sign In Failed', error.message || 'An error occurred with Google Sign-In');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('Signing in with Apple...');
      await signInWithApple(credential.identityToken!, credential.fullName || undefined);
      console.log('Apple sign-in successful');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Apple sign-in error:', error);
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled, do nothing
        return;
      }
      if (error.message === 'PHONE_REQUIRED') {
        // Show phone prompt modal
        if (user?.uid) {
          setPendingUserId(user.uid);
          setPhoneModalVisible(true);
        }
      } else {
        Alert.alert('Sign In Failed', error.message || 'An error occurred with Apple Sign-In');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneComplete = () => {
    setPhoneModalVisible(false);
    router.replace('/(tabs)');
  };

  const handlePhoneSkip = () => {
    setPhoneModalVisible(false);
    router.replace('/(tabs)');
  };

  const navigateToRegister = () => {
    router.push('/auth/register');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>MessageAI</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.socialButton, styles.googleButton]}
          onPress={() => promptAsync()}
          disabled={loading || !request}
        >
          <Text style={styles.socialButtonText}>🔵 Continue with Google</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.socialButton, styles.appleButton]}
            onPress={handleAppleSignIn}
            disabled={loading}
          >
            <Text style={[styles.socialButtonText, styles.appleButtonText]}>
              🍎 Continue with Apple
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={navigateToRegister} disabled={loading}>
            <Text style={styles.link}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>

      <PhonePromptModal
        visible={phoneModalVisible}
        userId={pendingUserId}
        onComplete={handlePhoneComplete}
        onCancel={handlePhoneSkip}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  link: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#999',
    fontSize: 14,
  },
  socialButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
  },
  appleButton: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  appleButtonText: {
    color: '#fff',
  },
});

