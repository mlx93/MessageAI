# Post-MVP Features Implementation Plan

**Version:** 1.0  
**Date:** October 23, 2025  
**Scope:** Critical UX gaps and group chat enhancements  
**Estimated Time:** 6-7 hours total

---

## Overview

This plan covers three phases of messaging UX improvements to bring MessageAI to iMessage-level polish. All features integrate seamlessly with existing architecture and follow established patterns.

**Key Principles:**
- Reuse existing services and patterns
- Minimal code changes per feature
- Leverage current UI components (gestures, modals, navigation)
- Maintain offline-first architecture

---

## PHASE 1: Critical Gaps (Must Fix)

**Time Estimate:** 2 hours  
**Files Modified:** 4  
**New Files:** 1 component

### 1.1 Delete Individual Messages (Long-Press)

**Goal:** Users can delete their own sent messages from all devices

**Current State:**
- Messages persist forever
- No deletion UI

**Implementation:**

#### **Step 1: Add Firestore Deletion Logic**
**File:** `services/messageService.ts`

Add new function:
```typescript
export const deleteMessage = async (
  conversationId: string,
  messageId: string,
  userId: string
): Promise<void> => {
  const messageRef = doc(db, `conversations/${conversationId}/messages/${messageId}`);
  const messageSnap = await getDoc(messageRef);
  
  if (!messageSnap.exists()) {
    throw new Error('Message not found');
  }
  
  const message = messageSnap.data();
  
  // Only allow deletion of own messages
  if (message.senderId !== userId) {
    throw new Error('Cannot delete messages from other users');
  }
  
  // Soft delete: Mark as deleted instead of removing
  await updateDoc(messageRef, {
    deleted: true,
    deletedAt: serverTimestamp(),
    text: 'Message deleted' // Preserve for notification history
  });
  
  // Update conversation last message if this was the last message
  const conversation = await getDoc(doc(db, 'conversations', conversationId));
  if (conversation.exists() && conversation.data().lastMessageId === messageId) {
    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessage: 'Message deleted',
      lastMessageTime: serverTimestamp()
    });
  }
};
```

**Why soft delete:**
- Preserves notification history
- Allows "undo" functionality later
- Maintains conversation flow
- Real-time listeners auto-update

#### **Step 2: Filter Deleted Messages in UI**
**File:** `app/chat/[id].tsx`

In the `subscribeToMessages` callback (around line 220), filter out deleted messages:
```typescript
const filteredMessages = messages.filter(msg => !msg.deleted);
setMessages(filteredMessages);
```

#### **Step 3: Add Long-Press Delete UI**
**File:** `app/chat/[id].tsx`

**Location:** Inside `MessageRow` component (around line 340)

Add long-press handler:
```typescript
import { Alert } from 'react-native';

// Inside MessageRow component, wrap message bubble:
<TouchableOpacity
  onLongPress={() => {
    if (message.senderId === user.uid && !message.deleted) {
      Alert.alert(
        'Delete Message',
        'Delete this message for everyone?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteMessage(conversationId, message.id, user.uid);
              } catch (error) {
                Alert.alert('Error', 'Failed to delete message');
              }
            }
          }
        ]
      );
    }
  }}
  activeOpacity={0.9}
>
  {/* Existing message bubble content */}
</TouchableOpacity>
```

**Testing:**
- ✅ Long-press own message → shows delete alert
- ✅ Delete → message disappears for all users
- ✅ Last message deletion → updates conversation preview
- ✅ Long-press other's message → no action
- ✅ Real-time sync across devices

---

### 1.2 Copy Message Text (Long-Press)

**Goal:** Users can copy message text to clipboard

**Current State:**
- No copy functionality

**Implementation:**

#### **Step 1: Install Clipboard API**
Already installed: `expo-clipboard` ✅

#### **Step 2: Add Copy Action to Long-Press**
**File:** `app/chat/[id].tsx`

Modify the long-press handler to show action sheet:
```typescript
import * as Clipboard from 'expo-clipboard';
import { ActionSheetIOS, Platform } from 'react-native';

const showMessageActions = (message: Message) => {
  const options = ['Copy', 'Cancel'];
  
  // Add Delete option only for own messages
  if (message.senderId === user.uid && !message.deleted) {
    options.unshift('Delete');
  }
  
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: message.senderId === user.uid ? 0 : undefined,
      },
      async (buttonIndex) => {
        if (message.senderId === user.uid) {
          // Options: Delete, Copy, Cancel
          if (buttonIndex === 0) {
            // Delete
            await deleteMessage(conversationId, message.id, user.uid);
          } else if (buttonIndex === 1) {
            // Copy
            await Clipboard.setStringAsync(message.text);
          }
        } else {
          // Options: Copy, Cancel
          if (buttonIndex === 0) {
            // Copy
            await Clipboard.setStringAsync(message.text);
          }
        }
      }
    );
  } else {
    // Android: Use Alert with buttons
    const buttons = [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Copy', 
        onPress: async () => {
          await Clipboard.setStringAsync(message.text);
        }
      }
    ];
    
    if (message.senderId === user.uid && !message.deleted) {
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMessage(conversationId, message.id, user.uid);
        }
      });
    }
    
    Alert.alert('Message Actions', null, buttons);
  }
};

// Replace onLongPress with:
onLongPress={() => showMessageActions(message)}
```

**Why ActionSheet:**
- Native iOS feel
- Extensible (add Forward later)
- Consistent with iMessage
- Better UX than multiple alerts

**Testing:**
- ✅ Long-press → shows Copy option
- ✅ Own messages → shows Copy + Delete
- ✅ Copy → text in clipboard
- ✅ Delete → message removed
- ✅ Works on iOS and Android

---

### 1.3 Profile Picture Upload Flow

**Goal:** Users can upload profile pictures from Camera Roll

**Current State:**
- `photoURL` field exists
- No upload UI
- Users stuck with initials

**Implementation:**

#### **Step 1: Add Profile Picture Upload to Image Service**
**File:** `services/imageService.ts`

Add new function:
```typescript
/**
 * Pick and upload profile picture
 * Returns download URL or null
 */
export const uploadProfilePicture = async (userId: string): Promise<string | null> => {
  try {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photos in Settings to upload a profile picture.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return null;
    }
    
    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square crop
      quality: 0.8
    });
    
    if (result.canceled || !result.assets[0]) {
      return null;
    }
    
    const uri = result.assets[0].uri;
    
    // Compress image (profile pics should be small)
    const compressedUri = await compressImage(uri, 400); // Max 400px
    
    // Upload to Storage
    const response = await fetch(compressedUri);
    const blob = await response.blob();
    
    const storageRef = ref(storage, `profilePictures/${userId}/${Date.now()}.jpg`);
    await uploadBytes(storageRef, blob);
    
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Failed to upload profile picture:', error);
    throw error;
  }
};
```

**Why square crop:**
- Consistent with avatars
- Better for thumbnails
- Standard across messaging apps

#### **Step 2: Add Upload Button to Edit Profile**
**File:** `app/auth/edit-profile.tsx`

Add camera button above name fields:
```typescript
import { uploadProfilePicture } from '../../services/imageService';

// Add state for loading
const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

// Add handler
const handleUploadPhoto = async () => {
  setIsUploadingPhoto(true);
  try {
    const photoURL = await uploadProfilePicture(user.uid);
    if (photoURL) {
      await updateUserProfile(user.uid, { photoURL });
      // Refresh user profile
      await refreshUserProfile();
      Alert.alert('Success', 'Profile picture updated');
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to upload profile picture');
  } finally {
    setIsUploadingPhoto(false);
  }
};

// Add UI (before name fields):
<View style={styles.photoSection}>
  <TouchableOpacity 
    onPress={handleUploadPhoto}
    disabled={isUploadingPhoto}
  >
    <View style={styles.avatarLarge}>
      {userProfile?.photoURL ? (
        <Image source={{ uri: userProfile.photoURL }} style={styles.avatarImage} />
      ) : (
        <Text style={styles.avatarInitials}>{userProfile?.initials}</Text>
      )}
      {isUploadingPhoto && (
        <ActivityIndicator 
          style={styles.uploadingOverlay} 
          size="large" 
          color="#007AFF" 
        />
      )}
    </View>
  </TouchableOpacity>
  <TouchableOpacity onPress={handleUploadPhoto} disabled={isUploadingPhoto}>
    <Text style={styles.changePhotoText}>
      {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
    </Text>
  </TouchableOpacity>
</View>
```

Add styles:
```typescript
photoSection: {
  alignItems: 'center',
  marginBottom: 30,
},
avatarLarge: {
  width: 100,
  height: 100,
  borderRadius: 50,
  backgroundColor: '#007AFF',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: 12,
},
avatarImage: {
  width: 100,
  height: 100,
  borderRadius: 50,
},
avatarInitials: {
  fontSize: 36,
  fontWeight: '600',
  color: '#FFF',
},
uploadingOverlay: {
  position: 'absolute',
  backgroundColor: 'rgba(0,0,0,0.5)',
  width: 100,
  height: 100,
  borderRadius: 50,
},
changePhotoText: {
  fontSize: 16,
  color: '#007AFF',
  fontWeight: '600',
},
```

#### **Step 3: Update Storage Rules**
**File:** `storage.rules`

Add profile pictures path (should already exist from Session 9):
```
match /profilePictures/{userId}/{imageId} {
  allow create: if request.auth != null
                && request.auth.uid == userId
                && request.resource.size < 10 * 1024 * 1024
                && request.resource.contentType.matches('image/.*');
  allow read: if request.auth != null;
  allow delete: if request.auth != null && request.auth.uid == userId;
}
```

**Testing:**
- ✅ Tap "Change Photo" → opens Camera Roll
- ✅ Select image → compresses and uploads
- ✅ Profile picture updates immediately
- ✅ Appears in all conversations
- ✅ Appears in contact list
- ✅ Works on iOS and Android

---

## PHASE 2: Group Chat UX (High Value)

**Time Estimate:** 3 hours  
**Files Modified:** 2  
**New Files:** 2 screens

### 2.1 Visible Participant List (Tap Header → Info Screen)

**Goal:** Users can tap chat header to view group info and participants

**Current State:**
- Can only see participants when adding new ones
- No way to view group details

**Implementation:**

#### **Step 1: Create Group Info Screen**
**New File:** `app/chat/group-info.tsx`

```typescript
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getConversation } from '../../services/conversationService';
import { useAuth } from '../../store/AuthContext';

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  
  useEffect(() => {
    loadGroupInfo();
  }, [id]);
  
  const loadGroupInfo = async () => {
    const conv = await getConversation(id);
    setConversation(conv);
    
    // Convert participantDetails to array
    const participantArray = Object.entries(conv.participantDetails).map(([uid, details]: [string, any]) => ({
      uid,
      ...details
    }));
    setParticipants(participantArray);
  };
  
  const handleViewContact = (participantId: string) => {
    router.push(`/chat/contact-info?userId=${participantId}`);
  };
  
  const handleLeaveGroup = () => {
    // Will implement in 2.2
  };
  
  return (
    <View style={styles.container}>
      {/* Group Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{conversation?.type === 'group' ? 'Group Info' : 'Contact Info'}</Text>
        <Text style={styles.subtitle}>{participants.length} participants</Text>
      </View>
      
      {/* Participants List */}
      <FlatList
        data={participants}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.participantRow}
            onPress={() => handleViewContact(item.uid)}
          >
            <View style={styles.avatar}>
              {item.photoURL ? (
                <Image source={{ uri: item.photoURL }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{item.initials}</Text>
              )}
            </View>
            <View style={styles.participantInfo}>
              <Text style={styles.participantName}>{item.displayName}</Text>
              {item.uid === user?.uid && (
                <Text style={styles.youLabel}>You</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      
      {/* Leave Group Button (only for groups) */}
      {conversation?.type === 'group' && (
        <TouchableOpacity 
          style={styles.leaveButton}
          onPress={handleLeaveGroup}
        >
          <Text style={styles.leaveButtonText}>Leave Group</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFF',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 17,
    fontWeight: '400',
  },
  youLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginLeft: 64,
  },
  leaveButton: {
    backgroundColor: '#FFF',
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    marginTop: 20,
  },
  leaveButtonText: {
    fontSize: 17,
    color: '#FF3B30',
    fontWeight: '600',
  },
});
```

#### **Step 2: Add Tap Handler to Chat Header**
**File:** `app/chat/[id].tsx`

Modify header title to be tappable:
```typescript
// Around line 150, in navigation.setOptions():
headerTitle: isAddMode || conversation.type !== 'direct' ? undefined : () => (
  <TouchableOpacity onPress={handleViewGroupInfo}>
    <View style={{ flexDirection: 'column', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontSize: 17, fontWeight: '600', marginRight: 6 }}>
          {title}
        </Text>
        {conversation.type === 'group' && (
          <Ionicons name="information-circle-outline" size={18} color="#007AFF" />
        )}
      </View>
      {/* Show participant count for groups */}
      {conversation.type === 'group' && (
        <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
          {conversation.participants.length} participants
        </Text>
      )}
    </View>
  </TouchableOpacity>
),

// Add handler function:
const handleViewGroupInfo = () => {
  if (conversation.type === 'group') {
    router.push(`/chat/group-info?id=${conversationId}`);
  }
};
```

**Testing:**
- ✅ Tap group header → opens group info screen
- ✅ Shows all participants with avatars
- ✅ Shows participant count
- ✅ Direct chats → no action on tap
- ✅ "You" label on current user

---

### 2.2 Leave Group Functionality

**Goal:** Users can leave group conversations

**Current State:**
- No way to leave groups
- Must stay in group forever

**Implementation:**

#### **Step 1: Add Leave Group Service Function**
**File:** `services/conversationService.ts`

Add new function:
```typescript
/**
 * Remove user from group conversation
 * If last participant, mark conversation as deleted
 */
export const leaveConversation = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationSnap = await getDoc(conversationRef);
  
  if (!conversationSnap.exists()) {
    throw new Error('Conversation not found');
  }
  
  const conversation = conversationSnap.data();
  
  // Only allow leaving groups
  if (conversation.type !== 'group') {
    throw new Error('Cannot leave direct conversations');
  }
  
  // Check if user is participant
  if (!conversation.participants.includes(userId)) {
    throw new Error('User is not a participant');
  }
  
  // Remove user from participants array
  const updatedParticipants = conversation.participants.filter((id: string) => id !== userId);
  
  // If only one participant left, convert to deletedBy array
  if (updatedParticipants.length === 1) {
    await updateDoc(conversationRef, {
      participants: updatedParticipants,
      deletedBy: arrayUnion(...updatedParticipants) // Hide for last person too
    });
  } else {
    // Remove from participant list and participant details
    const updatedDetails = { ...conversation.participantDetails };
    delete updatedDetails[userId];
    
    await updateDoc(conversationRef, {
      participants: updatedParticipants,
      participantDetails: updatedDetails,
      // Add to deletedBy so it disappears from leaver's list
      deletedBy: arrayUnion(userId)
    });
  }
  
  // Send system message
  await addDoc(collection(db, `conversations/${conversationId}/messages`), {
    text: `${conversation.participantDetails[userId]?.displayName || 'User'} left the group`,
    type: 'system',
    timestamp: serverTimestamp(),
    senderId: 'system'
  });
};
```

**Why system message:**
- Informs other participants
- Shows in conversation history
- Matches WhatsApp/iMessage behavior

#### **Step 2: Wire Up Leave Button**
**File:** `app/chat/group-info.tsx`

Implement `handleLeaveGroup`:
```typescript
import { leaveConversation } from '../../services/conversationService';

const handleLeaveGroup = () => {
  Alert.alert(
    'Leave Group',
    'Are you sure you want to leave this group?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveConversation(id, user.uid);
            // Navigate back to Messages list
            router.replace('/(tabs)');
            Alert.alert('Success', 'You left the group');
          } catch (error) {
            Alert.alert('Error', 'Failed to leave group');
          }
        }
      }
    ]
  );
};
```

**Testing:**
- ✅ Tap "Leave Group" → shows confirmation
- ✅ Confirm → removes user from participants
- ✅ Navigates back to Messages list
- ✅ Conversation disappears from leaver's list
- ✅ System message appears for remaining users
- ✅ Last person leaving → conversation hidden for everyone

---

### 2.3 Participant Count in Header

**Goal:** Show "(N)" after group name in chat header

**Current State:**
- Header shows group name only
- No indication of group size

**Implementation:**

**File:** `app/chat/[id].tsx`

Already implemented in Step 2.2! The participant count is shown below the title:
```typescript
{conversation.type === 'group' && (
  <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
    {conversation.participants.length} participants
  </Text>
)}
```

**Alternative (inline with name):**
```typescript
<Text style={{ fontSize: 17, fontWeight: '600' }}>
  {title} {conversation.type === 'group' && `(${conversation.participants.length})`}
</Text>
```

**Testing:**
- ✅ Group chats show participant count
- ✅ Direct chats show no count
- ✅ Count updates when people join/leave

---

### 2.4 Contact Info Screen (Tap Participant Name)

**Goal:** View individual contact details from group info

**Current State:**
- Can see participants in group info
- Can't view individual profiles

**Implementation:**

#### **Step 1: Create Contact Info Screen**
**New File:** `app/chat/contact-info.tsx`

```typescript
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfile } from '../../services/authService';
import { createOrGetConversation } from '../../services/conversationService';
import { useAuth } from '../../store/AuthContext';
import { formatPhoneNumber } from '../../utils/phoneFormat';

export default function ContactInfoScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const [contact, setContact] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  
  useEffect(() => {
    loadContact();
  }, [userId]);
  
  const loadContact = async () => {
    const profile = await getUserProfile(userId);
    setContact(profile);
  };
  
  const handleStartChat = async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    try {
      const conversationId = await createOrGetConversation([user.uid, userId], user.uid);
      router.replace(`/chat/${conversationId}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to start conversation');
      setIsNavigating(false);
    }
  };
  
  if (!contact) {
    return <View style={styles.container}><Text>Loading...</Text></View>;
  }
  
  const isCurrentUser = userId === user?.uid;
  
  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          {contact.photoURL ? (
            <Image source={{ uri: contact.photoURL }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{contact.initials}</Text>
          )}
        </View>
        <Text style={styles.name}>{contact.displayName}</Text>
        {contact.isOnline && (
          <View style={styles.onlineContainer}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        )}
      </View>
      
      {/* Info Rows */}
      <View style={styles.infoSection}>
        {contact.email && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={24} color="#007AFF" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{contact.email}</Text>
            </View>
          </View>
        )}
        
        {contact.phoneNumber && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={24} color="#007AFF" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{formatPhoneNumber(contact.phoneNumber)}</Text>
            </View>
          </View>
        )}
      </View>
      
      {/* Actions */}
      {!isCurrentUser && (
        <View style={styles.actionsSection}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleStartChat}
            disabled={isNavigating}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#FFF" />
            <Text style={styles.actionButtonText}>
              {isNavigating ? 'Opening...' : 'Send Message'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    backgroundColor: '#FFF',
    paddingVertical: 40,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '600',
    color: '#FFF',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  onlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CD964',
    marginRight: 6,
  },
  onlineText: {
    fontSize: 14,
    color: '#4CD964',
  },
  infoSection: {
    backgroundColor: '#FFF',
    marginTop: 20,
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  infoTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 17,
    color: '#000',
  },
  actionsSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
});
```

**Testing:**
- ✅ Tap participant → shows contact info
- ✅ Shows profile picture or initials
- ✅ Shows email and phone
- ✅ Shows online status
- ✅ "Send Message" → opens/creates DM
- ✅ Current user → no "Send Message" button

---

## PHASE 3: Polish & Message Actions (Nice to Have)

**Time Estimate:** 1.5 hours  
**Files Modified:** 1

### 3.1 Message Actions Menu (Tap → Copy, Delete, Forward)

**Goal:** Tap message to show actions, not just long-press

**Current State:**
- Long-press shows actions ✅
- Tap does nothing

**Implementation:**

#### **Step 1: Add Tap Handler**
**File:** `app/chat/[id].tsx`

In the `MessageRow` component, add `onPress` alongside `onLongPress`:

```typescript
<TouchableOpacity
  onPress={() => showMessageActions(message)}  // Tap shows menu
  onLongPress={() => showMessageActions(message)}  // Long-press also shows menu
  activeOpacity={0.9}
>
  {/* Message bubble */}
</TouchableOpacity>
```

#### **Step 2: Add Forward Action (Stub)**
Update `showMessageActions` to include Forward:

```typescript
const showMessageActions = (message: Message) => {
  const options = ['Copy', 'Cancel'];
  
  if (message.senderId === user.uid && !message.deleted) {
    options.unshift('Delete');
  }
  
  // Add Forward option
  options.splice(options.length - 1, 0, 'Forward');
  
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: message.senderId === user.uid ? 0 : undefined,
      },
      async (buttonIndex) => {
        if (message.senderId === user.uid) {
          // Options: Delete, Copy, Forward, Cancel
          if (buttonIndex === 0) {
            await deleteMessage(conversationId, message.id, user.uid);
          } else if (buttonIndex === 1) {
            await Clipboard.setStringAsync(message.text);
          } else if (buttonIndex === 2) {
            handleForward(message);
          }
        } else {
          // Options: Copy, Forward, Cancel
          if (buttonIndex === 0) {
            await Clipboard.setStringAsync(message.text);
          } else if (buttonIndex === 1) {
            handleForward(message);
          }
        }
      }
    );
  } else {
    // Android Alert
    const buttons = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Copy', onPress: () => Clipboard.setStringAsync(message.text) },
      { text: 'Forward', onPress: () => handleForward(message) }
    ];
    
    if (message.senderId === user.uid && !message.deleted) {
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMessage(conversationId, message.id, user.uid)
      });
    }
    
    Alert.alert('Message Actions', null, buttons);
  }
};

const handleForward = (message: Message) => {
  // TODO: Navigate to forward screen (similar to new-message.tsx)
  // For now, show placeholder
  Alert.alert('Forward', 'Forward functionality coming soon');
};
```

**Why stub Forward:**
- Requires new screen (forward-message.tsx)
- Similar to new-message.tsx but pre-filled
- Can implement later if time allows

**Testing:**
- ✅ Tap message → shows action menu
- ✅ Copy works
- ✅ Delete works (own messages)
- ✅ Forward shows placeholder
- ✅ Cancel dismisses menu

---

## Implementation Checklist

### Phase 1 (2 hours)
- [ ] Add `deleteMessage` function to messageService.ts
- [ ] Add long-press delete to chat screen
- [ ] Add copy + delete action sheet
- [ ] Add `uploadProfilePicture` function to imageService.ts
- [ ] Add photo upload UI to edit-profile.tsx
- [ ] Update storage rules for profile pictures
- [ ] Test all Phase 1 features

### Phase 2 (3 hours)
- [ ] Create group-info.tsx screen
- [ ] Add tap handler to chat header
- [ ] Add `leaveConversation` function to conversationService.ts
- [ ] Wire up leave button
- [ ] Add participant count to header
- [ ] Create contact-info.tsx screen
- [ ] Test all Phase 2 features

### Phase 3 (1.5 hours)
- [ ] Add tap handler for message actions
- [ ] Add Forward to action sheet (stub)
- [ ] Test all Phase 3 features

---

## Testing Strategy

### Device Testing:
- ✅ Test on iOS Simulator (iPhone 17 Pro)
- ✅ Test on Android Emulator (Pixel 9 Pro)
- ⚠️ Real device testing recommended for gestures

### Scenario Testing:
1. **Delete Message Flow:**
   - Long-press own message → delete → disappears for all users
   - Long-press other's message → no delete option
   - Delete last message → updates conversation preview

2. **Copy Message Flow:**
   - Long-press message → copy → paste elsewhere to verify

3. **Profile Picture Flow:**
   - Tap Change Photo → select image → uploads and displays
   - Profile picture appears in conversations
   - Profile picture appears in contact list

4. **Group Info Flow:**
   - Tap group header → shows participant list
   - Tap participant → shows contact info
   - Tap "Send Message" → opens DM

5. **Leave Group Flow:**
   - Tap Leave Group → confirm → removed from group
   - System message appears for others
   - Conversation disappears from leaver's list

---

## Rollback Plan

If any feature breaks production:

1. **Delete Messages:**
   - Remove `deleteMessage` calls
   - Remove long-press handler
   - Messages persist (current behavior)

2. **Profile Pictures:**
   - Remove upload button
   - Users see initials (current behavior)

3. **Group Info:**
   - Remove tap handler
   - Users use Add button to see participants (current behavior)

---

## Time Budget

| Phase | Feature | Estimated | Actual |
|-------|---------|-----------|--------|
| 1 | Delete messages | 45 min | |
| 1 | Copy messages | 30 min | |
| 1 | Profile pictures | 45 min | |
| 2 | Group info screen | 60 min | |
| 2 | Leave group | 45 min | |
| 2 | Participant count | 15 min | |
| 2 | Contact info screen | 45 min | |
| 3 | Message actions menu | 30 min | |
| 3 | Forward stub | 15 min | |
| **Total** | | **6.5 hours** | |

---

## Post-Implementation

After completing all phases:

1. **Update Documentation:**
   - Update `COMPLETE_FEATURE_LIST.md`
   - Update memory bank
   - Add session notes

2. **Commit Strategy:**
   - Phase 1: "Add message deletion, copy, and profile picture upload"
   - Phase 2: "Add group info screen, leave group, and contact info"
   - Phase 3: "Add tap-to-show message actions menu"

3. **Demo Video Updates:**
   - Show message deletion
   - Show profile picture upload
   - Show group info and leaving
   - Show message actions

---

**Ready to implement? Start with Phase 1, test thoroughly, then move to Phase 2.**

