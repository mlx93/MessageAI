# MVP Implementation Plan - Messaging App (Complete)
**Timeline**: 28 Hours | **Stack**: React Native + Expo + Firebase | **Tools**: Cursor + GitHub
**Testing**: macOS Simulators (iOS Simulator + Android Emulator on MacBook)

---

## 🚀 Pre-Implementation Setup (Complete Before Hour 0)

### Development Environment Setup (2-3 hours)

**Install Core Tools**:
```bash
# Node.js 18+ and Watchman
brew install node watchman

# Expo & EAS CLI
npm install -g expo-cli eas-cli

# Firebase CLI (for Cloud Functions)
npm install -g firebase-tools

# Verify
node --version  # 18+
expo --version
firebase --version
```

**iOS Simulator Setup**:
- Install Xcode 14.3+ from App Store
- `xcode-select --install`
- `sudo gem install cocoapods`
- Open Xcode → Preferences → Components → Install iOS 16.4 Simulator

**Android Emulator Setup**:
- Install Android Studio
- Configure environment:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
source ~/.zshrc
```
- Create AVD: Android Studio → Device Manager → Create Device → Pixel 6, Android 13

**Verify Simulators**:
```bash
# iOS
xcrun simctl list devices available

# Android
emulator -list-avds
```

### Firebase Setup

**Create Project**:
1. https://console.firebase.google.com → "messaging-app-mvp"
2. Enable services: Authentication (Email, Google, Apple), Firestore (test mode), Storage, Cloud Messaging

**Register Apps**:
- iOS: Bundle `com.yourcompany.messagingapp` → Download `GoogleService-Info.plist`
- Android: Package `com.yourcompany.messagingapp` → Download `google-services.json`
- Web: Copy firebaseConfig object

**Initialize Cloud Functions**:
```bash
firebase login
firebase init functions
# Select JavaScript, install dependencies
```

### Setup Checklist
- [ ] Node.js 18+, Expo CLI, Firebase CLI installed
- [ ] iOS Simulator and Android Emulator working
- [ ] Firebase project with all services enabled
- [ ] Firebase config files downloaded
- [ ] Cloud Functions initialized
- [ ] GitHub repo created

---

## 📝 Implementation Phases (28 Hours)

**Phase 1**: Foundation & Auth (Hours 0-3)
**Phase 2**: User Discovery & Contacts (Hours 3-6)
**Phase 3**: Conversation Management (Hours 6-9)
**Phase 4**: Real-Time Messaging (Hours 9-12)
**Phase 5**: Offline & Persistence (Hours 12-15)
**Phase 6**: Presence & Typing (Hours 15-18)
**Phase 7**: Groups & Images (Hours 18-21)
**Phase 8**: Push Notifications (Hours 21-24)
**Phase 9**: Testing & Polish (Hours 24-28)

---

## PHASE 1: Foundation & Auth (Hours 0-3)

### Hour 0-1: Project Initialization

**Create Expo App**:
```bash
cd messaging-app-mvp
npx create-expo-app@latest . --template blank-typescript

# Core dependencies
npx expo install firebase expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar

# Storage & offline
npx expo install expo-sqlite @react-native-async-storage/async-storage

# UI & media
npx expo install expo-notifications expo-device expo-contacts expo-image-picker expo-image-manipulator react-native-gifted-chat

# Utilities
npm install date-fns uuid @react-native-community/netinfo

# Auth
npx expo install expo-auth-session expo-crypto expo-web-browser

# Testing
npm install --save-dev @testing-library/react-native @testing-library/jest-native jest-expo @types/uuid
```

**Project Structure**:
```bash
mkdir -p app/{auth,\(tabs\),chat} components/{chat,contacts} services/{__tests__} hooks/{__tests__} store utils types assets
```

**Configure package.json**:
```json
{
  "scripts": {
    "start": "expo start",
    "ios": "expo start --ios",
    "android": "expo start --android",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**jest.config.js**:
```javascript
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|firebase)'
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  collectCoverageFrom: ['app/**/*.{ts,tsx}', 'services/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}', '!**/__tests__/**']
};
```

**Firebase Config** (`services/firebase.ts`):
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  console.warn('Firestore persistence error:', err);
});

export default app;
```

**app.json** (add iOS/Android config, permissions for camera/photos/contacts, Google Sign-In config)

**Commit**: `git add . && git commit -m "Hour 0-1: Project init"`

### Hour 1-2: Email/Password Authentication

**Types** (`types/index.ts`):
```typescript
export interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phoneNumber: string; // E.164 format (normalized)
  photoURL: string | null;
  initials: string;
  online: boolean;
  lastSeen: Date;
  createdAt: Date;
  fcmToken?: string;
  // No settings object - read receipts always on for MVP
}

export interface Message {
  id: string;
  conversationId: string;
  text: string;
  senderId: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  type: 'text' | 'image' | 'system';
  mediaURL?: string;
  localId: string;
  readBy: string[];
  deliveredTo: string[];
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  lastMessage: { text: string; timestamp: Date; senderId: string };
  participantDetails: {
    [userId: string]: {
      displayName: string;
      photoURL: string | null;
      initials: string;
      unreadCount: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Auth Service** (`services/authService.ts`):
```typescript
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from '../types';

// Phone number normalization - accepts various formats, converts to E.164
export const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If already has country code (starts with +), return as-is
  if (cleaned.startsWith('+')) return cleaned;
  
  // If starts with 1 (US/Canada), add +
  if (cleaned.startsWith('1') && cleaned.length === 11) return `+${cleaned}`;
  
  // Otherwise assume US and add +1
  return `+1${cleaned}`;
};

export const signUp = async (email: string, password: string, firstName: string, lastName: string, phoneNumber: string): Promise<FirebaseUser> => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  // Create Firebase Auth user first
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Use batch write to create user profile + uniqueness indexes atomically
  const batch = writeBatch(db);
  
  const profile: User = {
    uid: user.uid, email, firstName, lastName,
    displayName: `${firstName} ${lastName}`,
    phoneNumber: normalizedPhone, photoURL: null,
    initials: `${firstName[0]}${lastName[0]}`.toUpperCase(),
    online: true, lastSeen: new Date(), createdAt: new Date()
  };
  
  // User profile
  batch.set(doc(db, 'users', user.uid), profile);
  
  // Email uniqueness index
  batch.set(doc(db, 'usersByEmail', email), { uid: user.uid, createdAt: new Date() });
  
  // Phone uniqueness index
  batch.set(doc(db, 'usersByPhone', normalizedPhone), { uid: user.uid, createdAt: new Date() });
  
  try {
    await batch.commit();
    return user;
  } catch (error: any) {
    // If batch fails due to security rules (email/phone already exists), delete auth user
    await user.delete();
    if (error.code === 'permission-denied') {
      throw new Error('Email or phone number already in use');
    }
    throw error;
  }
};

export const signIn = async (email: string, password: string): Promise<FirebaseUser> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'users', userCredential.user.uid), { online: true, lastSeen: new Date() }, { merge: true });
  return userCredential.user;
};

export const signOut = async (): Promise<void> => {
  if (auth.currentUser) {
    await setDoc(doc(db, 'users', auth.currentUser.uid), { online: false, lastSeen: new Date() }, { merge: true });
  }
  await firebaseSignOut(auth);
};

export const getUserProfile = async (uid: string): Promise<User | null> => {
  const docSnap = await getDoc(doc(db, 'users', uid));
  return docSnap.exists() ? (docSnap.data() as User) : null;
};
```

**Auth Context** (`store/AuthContext.tsx`):
```typescript
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
      setUser(firebaseUser);
      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser.uid);
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

  return <AuthContext.Provider value={{ user, userProfile, loading, signOut: handleSignOut }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

**Auth Screens** (`app/auth/login.tsx`, `app/auth/register.tsx`) - standard forms

**App Layout** (`app/_layout.tsx`, `app/index.tsx`) - navigation with auth check

**Test**: Register → Login → Sign Out

**Commit**: `git commit -am "Hour 1-2: Email auth"`

### Hour 2-3: Social Authentication (Google & Apple)

**Google Sign-In** (`services/authService.ts` - add):
```typescript
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

WebBrowser.maybeCompleteAuthSession();

export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: 'YOUR_EXPO_CLIENT_ID',
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    androidClientId: 'YOUR_ANDROID_CLIENT_ID',
    webClientId: 'YOUR_WEB_CLIENT_ID', // From Firebase
  });

  return { promptAsync, response };
};

export const signInWithGoogleCredential = async (idToken: string) => {
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  
  // Check if user profile exists, create if not
  const existingProfile = await getUserProfile(userCredential.user.uid);
  if (!existingProfile) {
    // Prompt for phone number (Google doesn't provide it)
    throw new Error('PHONE_REQUIRED');
  }
  
  await setDoc(doc(db, 'users', userCredential.user.uid), { online: true, lastSeen: new Date() }, { merge: true });
  return userCredential.user;
};
```

**Apple Sign-In** (`services/authService.ts` - add):
```typescript
import * as AppleAuthentication from 'expo-apple-authentication';
import { OAuthProvider, signInWithCredential as firebaseSignInWithCredential } from 'firebase/auth';

export const signInWithApple = async () => {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  
  const { identityToken, fullName } = credential;
  const provider = new OAuthProvider('apple.com');
  const oauthCredential = provider.credential({ idToken: identityToken! });
  
  const userCredential = await firebaseSignInWithCredential(auth, oauthCredential);
  
  // Check/create profile
  const existingProfile = await getUserProfile(userCredential.user.uid);
  if (!existingProfile && fullName) {
    // Create profile, prompt for phone
    throw new Error('PHONE_REQUIRED');
  }
  
  return userCredential.user;
};
```

**Update Login Screen** - add Google/Apple buttons

**Test**: Sign in with Google → Sign in with Apple

**Commit**: `git commit -am "Hour 2-3: Social auth"`

**Note on Push Notification Testing**: Push notifications in this MVP will be tested using Expo Go on iOS Simulator and Android Emulator. Expo Go supports push notifications in development mode, unlike native builds which require physical devices. This allows us to complete MVP testing on simulators/emulators only.

---

## PHASE 2: User Discovery & Contacts (Hours 3-6)

### Hour 3-4: Contact Import & Matching

**Contact Service** (`services/contactService.ts`):
```typescript
import * as Contacts from 'expo-contacts';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

export const requestContactsPermission = async (): Promise<boolean> => {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
};

export const importContacts = async (userId: string): Promise<void> => {
  const hasPermission = await requestContactsPermission();
  if (!hasPermission) throw new Error('Contacts permission denied');
  
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
  });
  
  if (!data.length) return;
  
  // Extract phone numbers
  const phoneNumbers = data
    .filter(contact => contact.phoneNumbers && contact.phoneNumbers.length > 0)
    .flatMap(contact => 
      contact.phoneNumbers!.map(phone => ({
        name: contact.name || 'Unknown',
        phoneNumber: normalizePhoneNumber(phone.number || '')
      }))
    )
    .filter(c => c.phoneNumber);
  
  // Match against app users
  const uniquePhones = [...new Set(phoneNumbers.map(c => c.phoneNumber))];
  const matchedUsers = await matchPhoneNumbers(uniquePhones);
  
  // Store in user's contacts subcollection
  for (const contact of phoneNumbers) {
    const matchedUser = matchedUsers.find(u => u.phoneNumber === contact.phoneNumber);
    await setDoc(doc(db, `users/${userId}/contacts`, contact.phoneNumber), {
      phoneNumber: contact.phoneNumber,
      name: contact.name,
      isAppUser: !!matchedUser,
      appUserId: matchedUser?.uid || null,
      lastSynced: new Date()
    });
  }
};

const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  // Ensure it starts with + (add +1 for US numbers if missing)
  return cleaned.startsWith('+') ? cleaned : `+1${cleaned}`;
};

const matchPhoneNumbers = async (phoneNumbers: string[]): Promise<User[]> => {
  const matches: User[] = [];
  
  // Firestore 'in' query limit is 10, batch the queries
  for (let i = 0; i < phoneNumbers.length; i += 10) {
    const batch = phoneNumbers.slice(i, i + 10);
    const q = query(collection(db, 'users'), where('phoneNumber', 'in', batch));
    const snapshot = await getDocs(q);
    snapshot.docs.forEach(doc => matches.push(doc.data() as User));
  }
  
  return matches;
};

export const getUserContacts = async (userId: string) => {
  const snapshot = await getDocs(collection(db, `users/${userId}/contacts`));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const searchUserByPhone = async (phoneNumber: string): Promise<User | null> => {
  const normalized = normalizePhoneNumber(phoneNumber);
  const q = query(collection(db, 'users'), where('phoneNumber', '==', normalized));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as User;
};
```

**Contacts Screen** (`app/(tabs)/contacts.tsx`):
```typescript
import { View, FlatList, Text, TouchableOpacity, TextInput, Button, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getUserContacts, importContacts, searchUserByPhone } from '../../services/contactService';
import { router } from 'expo-router';
import { createOrGetConversation } from '../../services/conversationService';

export default function ContactsScreen() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [searchPhone, setSearchPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    if (!user) return;
    
    try {
      // Try to import contacts if first time
      await importContacts(user.uid);
    } catch (error) {
      console.log('Import contacts error:', error);
    }
    
    const userContacts = await getUserContacts(user.uid);
    setContacts(userContacts.filter(c => c.isAppUser));
  };

  const startConversation = async (contactUserId: string) => {
    if (!user) return;
    const conversationId = await createOrGetConversation([user.uid, contactUserId]);
    router.push(`/chat/${conversationId}`);
  };

  const searchAndStartChat = async () => {
    if (!searchPhone || !user) return;
    
    setLoading(true);
    try {
      const foundUser = await searchUserByPhone(searchPhone);
      if (foundUser) {
        const conversationId = await createOrGetConversation([user.uid, foundUser.uid]);
        router.push(`/chat/${conversationId}`);
      } else {
        Alert.alert('Not Found', 'No user found with that phone number');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Contacts on App</Text>
      
      <View style={{ marginBottom: 20 }}>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 5, marginBottom: 10 }}
          placeholder="Enter phone number (+1234567890)"
          value={searchPhone}
          onChangeText={setSearchPhone}
          keyboardType="phone-pad"
        />
        <Button title={loading ? "Searching..." : "Start Chat"} onPress={searchAndStartChat} disabled={loading} />
      </View>
      
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => startConversation(item.appUserId)}
            style={{ padding: 15, borderBottomWidth: 1, borderColor: '#eee' }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
            <Text style={{ color: '#666' }}>{item.phoneNumber}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
```

**Update Tab Layout** - add Contacts tab

**Test**: Import contacts → See matched users → Search by phone → Start chat

**Integration Test** (`services/__tests__/contactService.integration.test.ts`):
```typescript
// Test: Import contacts → Match against users → Can search by phone
```

**Commit**: `git commit -am "Hour 3-4: Contacts import"`

### Hour 4-6: Conversation Management & Firestore Indexes

**Conversation Service** (`services/conversationService.ts`):
```typescript
import { collection, doc, setDoc, getDoc, query, where, getDocs, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Conversation, User } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const createOrGetConversation = async (participantIds: string[]): Promise<string> => {
  const sorted = [...participantIds].sort();
  
  // For direct messages, check if conversation exists
  if (participantIds.length === 2) {
    const q = query(
      collection(db, 'conversations'),
      where('type', '==', 'direct'),
      where('participants', '==', sorted)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
  }
  
  // Create new conversation
  const conversationId = participantIds.length === 2 
    ? sorted.join('_')  // Deterministic ID for direct messages
    : uuidv4();  // Random UUID for groups
  
  // Fetch participant details
  const participantDetails: any = {};
  for (const uid of participantIds) {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      participantDetails[uid] = {
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        initials: userData.initials,
        unreadCount: 0
      };
    }
  }
  
  const conversation: Conversation = {
    id: conversationId,
    type: participantIds.length === 2 ? 'direct' : 'group',
    participants: participantIds,
    lastMessage: { text: '', timestamp: new Date(), senderId: '' },
    participantDetails,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await setDoc(doc(db, 'conversations', conversationId), conversation);
  
  return conversationId;
};

export const getUserConversations = (userId: string, callback: (conversations: Conversation[]) => void) => {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
    callback(conversations);
  });
};

export const updateConversationLastMessage = async (conversationId: string, text: string, senderId: string) => {
  await setDoc(doc(db, 'conversations', conversationId), {
    lastMessage: { text, timestamp: Timestamp.now(), senderId },
    updatedAt: Timestamp.now()
  }, { merge: true });
};

export const addParticipantToConversation = async (conversationId: string, userId: string) => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationSnap = await getDoc(conversationRef);
  
  if (!conversationSnap.exists()) throw new Error('Conversation not found');
  
  const conversation = conversationSnap.data() as Conversation;
  
  // Add participant
  const updatedParticipants = [...conversation.participants, userId];
  
  // Fetch new participant details
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (userSnap.exists()) {
    const userData = userSnap.data() as User;
    conversation.participantDetails[userId] = {
      displayName: userData.displayName,
      photoURL: userData.photoURL,
      initials: userData.initials,
      unreadCount: 0
    };
  }
  
  // Update conversation type if now 3+ participants
  const newType = updatedParticipants.length >= 3 ? 'group' : 'direct';
  
  await setDoc(conversationRef, {
    participants: updatedParticipants,
    type: newType,
    participantDetails: conversation.participantDetails
  }, { merge: true });
};
```

**Conversations List Screen** (`app/(tabs)/index.tsx`):
```typescript
import { View, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getUserConversations } from '../../services/conversationService';
import { Conversation } from '../../types';
import { router } from 'expo-router';
import { formatTimestamp } from '../../utils/messageHelpers';

export default function ConversationsScreen() {
  const { user, userProfile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = getUserConversations(user.uid, (convos) => {
      setConversations(convos);
    });
    
    return unsubscribe;
  }, [user]);

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.type === 'direct') {
      const otherUserId = conversation.participants.find(id => id !== user!.uid);
      return conversation.participantDetails[otherUserId!]?.displayName || 'Unknown';
    } else {
      const names = conversation.participants
        .filter(id => id !== user!.uid)
        .map(id => conversation.participantDetails[id]?.displayName.split(' ')[0])
        .slice(0, 3)
        .join(', ');
      return names + (conversation.participants.length > 4 ? '...' : '');
    }
  };

  const getInitials = (conversation: Conversation) => {
    if (conversation.type === 'direct') {
      const otherUserId = conversation.participants.find(id => id !== user!.uid);
      return conversation.participantDetails[otherUserId!]?.initials || '?';
    }
    return '👥';  // Group icon
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const unreadCount = item.participantDetails[user!.uid]?.unreadCount || 0;
    
    return (
      <TouchableOpacity 
        style={styles.conversationItem}
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item)}</Text>
        </View>
        
        <View style={styles.conversationDetails}>
          <View style={styles.header}>
            <Text style={styles.title}>{getConversationTitle(item)}</Text>
            <Text style={styles.timestamp}>
              {item.lastMessage.timestamp ? formatTimestamp(item.lastMessage.timestamp) : ''}
            </Text>
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage.text || 'No messages yet'}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#666' }}>No conversations yet</Text>
            <Text style={{ color: '#999', marginTop: 10 }}>Go to Contacts to start chatting</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conversationItem: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  conversationDetails: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  title: { fontSize: 16, fontWeight: '600' },
  timestamp: { fontSize: 12, color: '#999' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, color: '#666', flex: 1 },
  unreadBadge: { backgroundColor: '#007AFF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 10 },
  unreadText: { color: 'white', fontSize: 12, fontWeight: 'bold' }
});
```

**Firestore Indexes Setup**:

In Firebase Console → Firestore → Indexes → Create Index:

1. **Conversations ordered by updatedAt**:
   - Collection: `conversations`
   - Fields: `participants` (Array-contains), `updatedAt` (Descending)
   - Query scope: Collection

2. **Messages ordered by timestamp**:
   - Collection group: `messages`
   - Fields: `conversationId` (Ascending), `timestamp` (Ascending)
   - Query scope: Collection group

Or let Firestore auto-create indexes when queries fail (it will show a link in console).

**Test**: Open app → See conversations list → Tap conversation → Navigate to chat

**Commit**: `git commit -am "Hour 4-6: Conversations & indexes"`

---

## PHASE 3: Real-Time Messaging (Hours 6-12)

### Hour 6-9: Message Service & Chat UI

**Message Service** (`services/messageService.ts`):
```typescript
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { Message } from '../types';

export const sendMessage = async (conversationId: string, text: string, senderId: string, localId: string): Promise<string> => {
  const messageRef = await addDoc(collection(db, `conversations/${conversationId}/messages`), {
    text, senderId,
    timestamp: Timestamp.now(),
    status: 'sent',
    type: 'text',
    localId,
    readBy: [senderId],
    deliveredTo: []
  });
  
  return messageRef.id;
};

export const subscribeToMessages = (conversationId: string, callback: (messages: Message[]) => void) => {
  const q = query(
    collection(db, `conversations/${conversationId}/messages`),
    orderBy('timestamp', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date()
      } as Message;
    });
    callback(messages);
  });
};

export const markMessagesAsRead = async (conversationId: string, userId: string, messageIds: string[]) => {
  const batch = writeBatch(db);
  
  for (const messageId of messageIds) {
    const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
    batch.update(messageRef, {
      readBy: arrayUnion(userId),
      status: 'read'
    });
  }
  
  await batch.commit();
};

export const markMessageAsDelivered = async (conversationId: string, messageId: string, userId: string) => {
  const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
  await updateDoc(messageRef, {
    deliveredTo: arrayUnion(userId),
    status: 'delivered'
  });
};
```

**Chat Screen** (`app/chat/[id].tsx`):
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, Text } from 'react-native';
import { GiftedChat, IMessage } from 'react-native-gifted-chat';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../store/AuthContext';
import { subscribeToMessages, sendMessage, markMessagesAsRead, markMessageAsDelivered } from '../../services/messageService';
import { updateConversationLastMessage, addParticipantToConversation } from '../../services/conversationService';
import { Message } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { cacheMessage } from '../../services/sqliteService';
import { queueMessage } from '../../services/offlineQueue';
import NetInfo from '@react-native-community/netinfo';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const conversationId = id as string;
  const hasMarkedRead = useRef(false);

  useEffect(() => {
    // Network status
    const unsubscribeNet = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected || false);
    });

    // Subscribe to messages
    const unsubscribeMessages = subscribeToMessages(conversationId, (msgs) => {
      const giftedMessages = msgs.map(m => ({
        _id: m.id,
        text: m.text,
        createdAt: m.timestamp,
        user: { _id: m.senderId },
        sent: m.status !== 'sending',
        received: m.status === 'delivered' || m.status === 'read',
        pending: m.status === 'sending'
      }));
      
      setMessages(giftedMessages.reverse());
      
      // Mark messages as delivered if not from current user
      msgs.filter(m => m.senderId !== user!.uid && !m.deliveredTo.includes(user!.uid))
        .forEach(m => markMessageAsDelivered(conversationId, m.id, user!.uid));
      
      // Mark as read when viewing
      if (!hasMarkedRead.current) {
        const unreadIds = msgs.filter(m => m.senderId !== user!.uid && !m.readBy.includes(user!.uid)).map(m => m.id);
        if (unreadIds.length > 0) {
          markMessagesAsRead(conversationId, user!.uid, unreadIds);
          hasMarkedRead.current = true;
        }
      }
      
      // Cache messages
      msgs.forEach(m => cacheMessage(m));
    });

    return () => {
      unsubscribeNet();
      unsubscribeMessages();
    };
  }, [conversationId]);

  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    const message = newMessages[0];
    const localId = uuidv4();
    
    // Optimistic UI update
    setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));
    
    try {
      if (isOnline) {
        await sendMessage(conversationId, message.text, user!.uid, localId);
        await updateConversationLastMessage(conversationId, message.text, user!.uid);
      } else {
        // Queue for later
        await queueMessage({ conversationId, text: message.text, senderId: user!.uid, localId });
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to send message: ' + error.message);
    }
  }, [conversationId, user, isOnline]);

  const handleAddParticipant = () => {
    router.push(`/chat/add-participant?conversationId=${conversationId}`);
  };

  return (
    <View style={{ flex: 1 }}>
      {!isOnline && (
        <View style={{ backgroundColor: '#ff9800', padding: 8 }}>
          <Text style={{ color: 'white', textAlign: 'center' }}>Offline - Messages will send when connected</Text>
        </View>
      )}
      
      <TouchableOpacity 
        style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, backgroundColor: '#007AFF', padding: 10, borderRadius: 20 }}
        onPress={handleAddParticipant}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>+ Add</Text>
      </TouchableOpacity>
      
      <GiftedChat
        messages={messages}
        onSend={messages => onSend(messages)}
        user={{ _id: user!.uid }}
        renderUsernameOnMessage
        showUserAvatar
      />
    </View>
  );
}
```

**Add Participant Screen** (`app/chat/add-participant.tsx`):
```typescript
import { View, TextInput, Button, Alert } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { searchUserByPhone } from '../../services/contactService';
import { addParticipantToConversation } from '../../services/conversationService';

export default function AddParticipantScreen() {
  const { conversationId } = useLocalSearchParams();
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleAddUser = async () => {
    try {
      const user = await searchUserByPhone(phoneNumber);
      if (user) {
        await addParticipantToConversation(conversationId as string, user.uid);
        Alert.alert('Success', 'Participant added!');
        router.back();
      } else {
        Alert.alert('Not Found', 'No user with that phone number');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <TextInput
        style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
        placeholder="Phone number (+1234567890)"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
      />
      <Button title="Add Participant" onPress={handleAddUser} />
    </View>
  );
}
```

**Test on 2 Simulators**: 
- iOS Simulator + Android Emulator
- Register 2 users, start conversation, send messages
- Messages should appear in < 1 second

**Commit**: `git commit -am "Hour 6-9: Real-time messaging"`

### Hour 9-12: Offline Support & SQLite

**SQLite Service** (`services/sqliteService.ts`):
```typescript
import * as SQLite from 'expo-sqlite';
import { Message, Conversation } from '../types';

const db = SQLite.openDatabase('messages.db');

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(`CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversationId TEXT,
        text TEXT,
        senderId TEXT,
        timestamp INTEGER,
        status TEXT,
        type TEXT,
        localId TEXT,
        readBy TEXT,
        deliveredTo TEXT
      )`, [], () => {
        tx.executeSql(`CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          type TEXT,
          participants TEXT,
          lastMessage TEXT,
          participantDetails TEXT,
          updatedAt INTEGER
        )`, [], () => resolve(), (_, error) => { reject(error); return false; });
      }, (_, error) => { reject(error); return false; });
    });
  });
};

export const cacheMessage = (message: Message): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          message.id, message.conversationId, message.text, message.senderId,
          message.timestamp.getTime(), message.status, message.type, message.localId,
          JSON.stringify(message.readBy), JSON.stringify(message.deliveredTo)
        ],
        () => resolve(),
        (_, error) => { reject(error); return false; }
      );
    });
  });
};

export const getCachedMessages = (conversationId: string): Promise<Message[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC',
        [conversationId],
        (_, { rows }) => {
          const messages = rows._array.map(row => ({
            ...row,
            timestamp: new Date(row.timestamp),
            readBy: JSON.parse(row.readBy),
            deliveredTo: JSON.parse(row.deliveredTo)
          }));
          resolve(messages);
        },
        (_, error) => { reject(error); return false; }
      );
    });
  });
};

export const cacheConversation = (conversation: Conversation): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'INSERT OR REPLACE INTO conversations VALUES (?, ?, ?, ?, ?, ?)',
        [
          conversation.id, conversation.type, JSON.stringify(conversation.participants),
          JSON.stringify(conversation.lastMessage), JSON.stringify(conversation.participantDetails),
          conversation.updatedAt.getTime()
        ],
        () => resolve(),
        (_, error) => { reject(error); return false; }
      );
    });
  });
};
```

**Offline Queue** (`services/offlineQueue.ts`):
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendMessage } from './messageService';
import { updateConversationLastMessage } from './conversationService';

const QUEUE_KEY = 'offline_messages';

interface QueuedMessage {
  conversationId: string;
  text: string;
  senderId: string;
  localId: string;
  retryCount: number;
}

export const queueMessage = async (message: Omit<QueuedMessage, 'retryCount'>): Promise<void> => {
  const queue = await getQueue();
  queue.push({ ...message, retryCount: 0 });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const getQueue = async (): Promise<QueuedMessage[]> => {
  const data = await AsyncStorage.getItem(QUEUE_KEY);
  return data ? JSON.parse(data) : [];
};

export const processQueue = async (): Promise<void> => {
  const queue = await getQueue();
  const remaining: QueuedMessage[] = [];
  
  for (const msg of queue) {
    try {
      await sendMessage(msg.conversationId, msg.text, msg.senderId, msg.localId);
      await updateConversationLastMessage(msg.conversationId, msg.text, msg.senderId);
    } catch (error) {
      if (msg.retryCount < 3) {
        const delay = Math.pow(2, msg.retryCount + 1) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
        remaining.push({ ...msg, retryCount: msg.retryCount + 1 });
      } else {
        // Mark as failed in UI (handled elsewhere)
        console.log('Message failed after 3 retries:', msg.localId);
      }
    }
  }
  
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
};
```

**Update App Entry** (`app/_layout.tsx` - add SQLite init):
```typescript
import { useEffect } from 'react';
import { initDB } from '../services/sqliteService';
import NetInfo from '@react-native-community/netinfo';
import { processQueue } from '../services/offlineQueue';

export default function RootLayout() {
  useEffect(() => {
    initDB();
    
    // Process queue on network reconnect
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        processQueue();
      }
    });
    
    return unsubscribe;
  }, []);
  
  // ... rest of layout
}
```

**Test**: Turn on airplane mode → Send message → Turn off → Should deliver

**Commit**: `git commit -am "Hour 9-12: Offline support"`

---

## PHASE 4: Presence & Typing (Hours 12-18)

### Hour 12-15: Presence System

**Presence Service** (`services/presenceService.ts`):
```typescript
import { doc, setDoc, onSnapshot, onDisconnect, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export const setUserOnline = async (userId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, { online: true, lastSeen: new Date() }, { merge: true });
  
  // Set offline on disconnect
  onDisconnect(userRef).update({ online: false, lastSeen: new Date() });
};

export const setUserOffline = async (userId: string): Promise<void> => {
  await setDoc(doc(db, 'users', userId), { online: false, lastSeen: new Date() }, { merge: true });
};

export const subscribeToUserPresence = (userId: string, callback: (online: boolean, lastSeen?: Date) => void) => {
  return onSnapshot(doc(db, 'users', userId), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      callback(data.online, data.lastSeen?.toDate());
    }
  });
};
```

**Update Auth Context** - call `setUserOnline` on auth state change

**Typing Indicator Hook** (`hooks/useTypingIndicator.ts`):
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export const useTypingIndicator = (conversationId: string, userId: string, displayName: string) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTyping = useCallback(async () => {
    await setDoc(doc(db, `conversations/${conversationId}/typing/${userId}`), {
      isTyping: true, displayName, timestamp: new Date()
    });
    
    // Clear existing timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // Stop typing after 500ms of inactivity
    timeoutRef.current = setTimeout(async () => {
      await setDoc(doc(db, `conversations/${conversationId}/typing/${userId}`), {
        isTyping: false, displayName, timestamp: new Date()
      });
    }, 500);
  }, [conversationId, userId, displayName]);

  return { startTyping };
};

export const useTypingStatus = (conversationId: string, currentUserId: string) => {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, `conversations/${conversationId}/typing`),
      (snapshot) => {
        const typing = snapshot.docs
          .filter(doc => doc.id !== currentUserId && doc.data().isTyping)
          .map(doc => doc.data().displayName);
        setTypingUsers(typing);
      }
    );

    return unsubscribe;
  }, [conversationId, currentUserId]);

  const getTypingText = () => {
    if (typingUsers.length === 0) return '';
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return `${typingUsers[0]}, ${typingUsers[1]}, and ${typingUsers.length - 2} others are typing...`;
  };

  return { typingText: getTypingText() };
};
```

**Update Chat Screen** - add typing indicator, call startTyping on text change

**Test**: Type in one simulator → See "User is typing..." in other

**Commit**: `git commit -am "Hour 12-15: Presence & typing"`

---

## PHASE 5: Groups & Images (Hours 15-21)

### Hour 15-18: Group Chat Polish

Groups already work from earlier! Just test:
- Add 3rd participant → conversation becomes group
- All 3 devices receive messages
- Typing shows individual names

### Hour 18-21: Image Upload

**Image Service** (`services/imageService.ts`):
```typescript
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const pickImage = async (): Promise<string | null> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Permission to access photos is required!');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
  });

  if (result.canceled) return null;
  return result.assets[0].uri;
};

export const compressImage = async (uri: string): Promise<string> => {
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1920 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return compressed.uri;
};

export const uploadImage = async (uri: string, conversationId: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  
  // Check size
  const size = blob.size;
  let finalUri = uri;
  
  if (size > 5 * 1024 * 1024) {
    finalUri = await compressImage(uri);
  }
  
  const imageRef = ref(storage, `images/${conversationId}/${Date.now()}.jpg`);
  const finalBlob = await (await fetch(finalUri)).blob();
  await uploadBytes(imageRef, finalBlob);
  
  return await getDownloadURL(imageRef);
};
```

**Update Message Service** - add sendImageMessage function

**Update Chat Screen** - add image picker button, handle image messages

**Test**: Pick image → Upload → Appears in chat

**Commit**: `git commit -am "Hour 18-21: Images"`

---

## PHASE 6: Push Notifications (Hours 21-24)

### Hour 21-24: FCM & Cloud Functions

**Notification Service** (`services/notificationService.ts`):
```typescript
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const registerForPushNotifications = async (userId: string): Promise<void> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') return;
  
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await setDoc(doc(db, 'users', userId), { fcmToken: token }, { merge: true });
};

export const setActiveConversation = async (userId: string, conversationId: string | null): Promise<void> => {
  await setDoc(doc(db, 'activeConversations', userId), {
    conversationId,
    lastActive: new Date()
  });
};
```

**Cloud Function** (`functions/index.js`):
```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendMessageNotification = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const conversationId = context.params.conversationId;
    
    // Get conversation
    const conversationSnap = await admin.firestore().doc(`conversations/${conversationId}`).get();
    const conversation = conversationSnap.data();
    
    // Get recipients (exclude sender)
    const recipients = conversation.participants.filter(id => id !== message.senderId);
    
    // Check who's actively in this conversation
    const activeUsers = [];
    for (const userId of recipients) {
      const activeSnap = await admin.firestore().doc(`activeConversations/${userId}`).get();
      if (activeSnap.exists() && activeSnap.data().conversationId === conversationId) {
        activeUsers.push(userId);
      }
    }
    
    // Send to inactive users
    const usersToNotify = recipients.filter(id => !activeUsers.includes(id));
    
    for (const userId of usersToNotify) {
      const userSnap = await admin.firestore().doc(`users/${userId}`).get();
      const fcmToken = userSnap.data()?.fcmToken;
      
      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: conversation.participantDetails[message.senderId]?.displayName || 'New Message',
            body: message.text
          },
          data: {
            conversationId: conversationId
          }
        });
      }
    }
  });
```

**Deploy Cloud Function**:
```bash
cd functions
npm install firebase-admin firebase-functions
cd ..
firebase deploy --only functions
```

**Update Chat Screen** - call setActiveConversation on mount/unmount

**Test**: Background app → Send message → Receive notification

**Commit**: `git commit -am "Hour 21-24: Push notifications"`

---

## PHASE 7: Testing (Hours 24-28)

### Hour 24-28: Full Testing & Polish

**Run All 7 Test Scenarios**:

1. **Real-time (2 simulators)**: Send 20 messages rapidly ✅
2. **Offline resilience**: Airplane mode → send → reconnect ✅
3. **Background**: Background app → send message → notification ✅
4. **Persistence**: Force quit → reopen → messages visible ✅
5. **Poor network**: Throttle to 3G (use Network Link Conditioner) ✅
6. **Rapid-fire**: Send 20+ quickly → all in order ✅
7. **Group chat**: 3 users → all receive ✅

**Polish**:
- Add loading states
- Error handling for all services
- UI improvements (avatars, timestamps, read receipts visual)
- Failed message retry button

**Final Integration Test Script** (`__tests__/e2e.test.md`):
```markdown
# E2E Test Checklist
- [ ] Register 2 users (iOS + Android simulators)
- [ ] Import contacts (if applicable)
- [ ] Start conversation from Contacts tab
- [ ] Send text message → appears on both devices < 1s
- [ ] Go offline → send message → reconnect → delivers within 10s
- [ ] Force quit app → reopen → messages persist
- [ ] Send image → uploads → displays
- [ ] Add 3rd participant → becomes group
- [ ] Type → see "typing..." indicator
- [ ] Background app → send message → notification appears
- [ ] Read receipts update correctly (always-on)
```

**Coverage Report**:
```bash
npm test -- --coverage
# Target: 70%+ statements
```

**Commit**: `git commit -am "Hour 24-28: Testing complete - MVP READY"`

---

## 🚀 Deployment

**Build for Testing**:
```bash
# Development build (Expo Go compatible)
npm start

# Production build (TestFlight/APK)
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

**Deploy Cloud Functions**:
```bash
firebase deploy --only functions
```

---

## ✅ MVP Completion Criteria

**All 10 MVP Features**:
- [x] One-on-one chat
- [x] Real-time delivery
- [x] Message persistence
- [x] Optimistic UI
- [x] Online/offline status
- [x] Timestamps
- [x] Authentication (Email + Google + Apple)
- [x] Group chat (3+)
- [x] Read receipts (always-on)
- [x] Push notifications

**All 7 Test Scenarios**: Passing on simulators

**Code Quality**: 70%+ test coverage

**Performance**: < 1s message delivery, instant cached load

**Deployment**: Running on iOS + Android simulators with deployed Firebase backend

---

## 🎉 MVP COMPLETE - Ready for Production Testing!