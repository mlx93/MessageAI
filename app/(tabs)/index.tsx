import { View, FlatList, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getUserConversations } from '../../services/conversationService';
import { Conversation } from '../../types';
import { router, useNavigation } from 'expo-router';
import { formatTimestamp } from '../../utils/messageHelpers';
import { Ionicons } from '@expo/vector-icons';

export default function ConversationsScreen() {
  const navigation = useNavigation();
  const { user, userProfile, signOut } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push('/new-message')} style={{ marginRight: 8 }}>
          <Ionicons name="create-outline" size={28} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setConversations([]); // Clear conversations when user signs out
      return;
    }
    
    const unsubscribe = getUserConversations(user.uid, (convos) => {
      setConversations(convos);
    });
    
    return unsubscribe;
  }, [user]);

  const getConversationTitle = (conversation: Conversation) => {
    if (!user) return 'Chat';
    if (conversation.type === 'direct') {
      const otherUserId = conversation.participants.find(id => id !== user.uid);
      return conversation.participantDetails[otherUserId!]?.displayName || 'Unknown';
    } else {
      const names = conversation.participants
        .filter(id => id !== user.uid)
        .map(id => conversation.participantDetails[id]?.displayName.split(' ')[0])
        .slice(0, 3)
        .join(', ');
      return names + (conversation.participants.length > 4 ? '...' : '');
    }
  };

  const getInitials = (conversation: Conversation) => {
    if (!user) return '?';
    if (conversation.type === 'direct') {
      const otherUserId = conversation.participants.find(id => id !== user.uid);
      return conversation.participantDetails[otherUserId!]?.initials || '?';
    }
    return '👥';  // Group icon
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/auth/login');
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to sign out');
          }
        },
      },
    ]);
  };

  const handleEditProfile = () => {
    router.push('/auth/edit-profile');
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    if (!user) return null; // Safety check
    const unreadCount = item.participantDetails[user.uid]?.unreadCount || 0;
    
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

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>
          {userProfile?.firstName} {userProfile?.lastName}
        </Text>
        <Text style={styles.userEmail}>{userProfile?.email}</Text>
      </View>
      <View style={styles.headerButtons}>
        <TouchableOpacity style={styles.headerButton} onPress={handleEditProfile}>
          <Text style={styles.headerButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.headerButton, styles.signOutButton]} onPress={handleSignOut}>
          <Text style={styles.headerButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>Go to Contacts to start chatting</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  userInfo: {
    marginBottom: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  conversationItem: { 
    flexDirection: 'row', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  avatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#007AFF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 15 
  },
  avatarText: { 
    color: 'white', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  conversationDetails: { 
    flex: 1 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 5 
  },
  title: { 
    fontSize: 16, 
    fontWeight: '600',
    color: '#000',
  },
  timestamp: { 
    fontSize: 12, 
    color: '#999' 
  },
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  lastMessage: { 
    fontSize: 14, 
    color: '#666', 
    flex: 1 
  },
  unreadBadge: { 
    backgroundColor: '#007AFF', 
    borderRadius: 10, 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    marginLeft: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: { 
    color: 'white', 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
