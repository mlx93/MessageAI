import { View, FlatList, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getUserConversations, deleteConversation } from '../../services/conversationService';
import { subscribeToMultipleUsersPresence } from '../../services/presenceService';
import { Conversation } from '../../types';
import { router, useNavigation } from 'expo-router';
import { formatTimestamp } from '../../utils/messageHelpers';
import { formatPhoneNumber } from '../../utils/phoneFormat';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export default function ConversationsScreen() {
  const navigation = useNavigation();
  const { user, userProfile, signOut } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, { online: boolean; lastSeen?: Date }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      setLoading(false);
      return;
    }
    
    try {
      setError(null);
      const unsubscribe = getUserConversations(user.uid, (convos) => {
        setConversations(convos);
        setLoading(false);
        setRefreshing(false);
      });
      
      return unsubscribe;
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    // The useEffect will handle reloading
  };

  // Subscribe to presence for all participants
  useEffect(() => {
    if (!user || conversations.length === 0) return;

    // Get all unique participant IDs (excluding current user)
    const allParticipantIds = Array.from(
      new Set(
        conversations.flatMap(conv => 
          conv.participants.filter(id => id !== user.uid)
        )
      )
    );

    if (allParticipantIds.length === 0) return;

    // Subscribe to presence
    const unsubscribes = subscribeToMultipleUsersPresence(
      allParticipantIds,
      (newPresenceMap) => {
        setPresenceMap(newPresenceMap);
      }
    );

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, conversations.length]);

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
            router.replace('/auth/phone-login');
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

  const handleDeleteConversation = (conversationId: string, conversationTitle: string) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${conversationTitle}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user) return;
              await deleteConversation(conversationId, user.uid);
              // Conversation will be automatically removed from list by the real-time listener
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete conversation');
            }
          },
        },
      ]
    );
  };

  // Swipeable Conversation Component
  const SwipeableConversationItem = ({ item }: { item: Conversation }) => {
    if (!user) return null;
    
    const translateX = useSharedValue(0);
    const [isNavigating, setIsNavigating] = useState(false);
    const unreadCount = item.participantDetails[user.uid]?.unreadCount || 0;
    const otherUserId = item.type === 'direct' 
      ? item.participants.find(id => id !== user.uid)
      : null;
    const isOnline = otherUserId ? presenceMap[otherUserId]?.online : false;

    const panGesture = Gesture.Pan()
      .onUpdate((event) => {
        // Only allow left swipe (negative translation)
        if (event.translationX < 0) {
          translateX.value = event.translationX;
        }
      })
      .onEnd((event) => {
        if (event.translationX < -80) {
          // Threshold reached - reveal delete button
          translateX.value = withSpring(-80);
        } else {
          // Snap back
          translateX.value = withSpring(0);
        }
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    const handleDelete = () => {
      translateX.value = withSpring(0); // Close swipe before deleting
      const title = getConversationTitle(item);
      setTimeout(() => {
        runOnJS(handleDeleteConversation)(item.id, title);
      }, 300);
    };

    const handlePress = () => {
      if (translateX.value < -10) {
        // Close if swiped
        translateX.value = withSpring(0);
      } else if (!isNavigating) {
        // Prevent double navigation
        setIsNavigating(true);
        router.push(`/chat/${item.id}`);
        
        // Reset flag after navigation completes
        setTimeout(() => {
          setIsNavigating(false);
        }, 1000);
      }
    };

    return (
      <View style={styles.swipeableContainer}>
        {/* Delete Button (behind the item) */}
        <View style={styles.deleteButtonContainer}>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={24} color="#fff" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>

        {/* Swipeable Content */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[animatedStyle]}>
            <TouchableOpacity 
              style={styles.conversationItem}
              onPress={handlePress}
              activeOpacity={0.7}
            >
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(item)}</Text>
                </View>
                {item.type === 'direct' && isOnline && (
                  <View style={styles.onlineIndicator} />
                )}
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
          </Animated.View>
        </GestureDetector>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    return <SwipeableConversationItem item={item} />;
  };

  const renderHeader = () => {
    console.log('🎨 Rendering header with userProfile:', {
      firstName: userProfile?.firstName,
      lastName: userProfile?.lastName,
      displayName: userProfile?.displayName,
      email: userProfile?.email
    });
    
    // Format contact info - prefer email, fallback to formatted phone
    const contactInfo = userProfile?.email || 
                       (userProfile?.phoneNumber ? formatPhoneNumber(userProfile.phoneNumber) : '');
    
    return (
      <View style={styles.headerContainer}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {userProfile?.displayName || `${userProfile?.firstName} ${userProfile?.lastName}` || 'User'}
          </Text>
          <Text style={styles.userEmail}>{contactInfo}</Text>
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
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
            colors={['#007AFF']}
          />
        }
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
  swipeableContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
  },
  deleteButton: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  conversationItem: { 
    flexDirection: 'row', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#007AFF', 
    justifyContent: 'center', 
    alignItems: 'center', 
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CD964',
    borderWidth: 2,
    borderColor: '#fff',
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
