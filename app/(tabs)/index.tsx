import { View, FlatList, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, TextInput, ScrollView } from 'react-native';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getUserConversations, deleteConversation } from '../../services/conversationService';
import { subscribeToMultipleUsersPresence } from '../../services/presenceService';
import { Conversation } from '../../types';
import { router, useNavigation, useFocusEffect } from 'expo-router';
import { formatTimestamp } from '../../utils/messageHelpers';
import { formatPhoneNumber } from '../../utils/phoneFormat';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export default function ConversationsScreen() {
  const navigation = useNavigation();
  const { user, userProfile, signOut } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, { online: boolean; inApp: boolean; lastSeen?: Date }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedFirstName, setEditedFirstName] = useState('');
  const [editedLastName, setEditedLastName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const lastViewedConversationRef = useRef<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity 
          onPress={handleOpenProfile} 
          style={{ marginLeft: 16, flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#007AFF' }}>
            {userProfile?.firstName || 'Menu'}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#007AFF" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push('/new-message')} style={{ marginRight: 8 }}>
          <Ionicons name="create-outline" size={28} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [userProfile, handleOpenProfile]);

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
      });
      
      return unsubscribe;
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
      setLoading(false);
    }
  }, [user]);

  // Optimistically clear unread count when returning from a conversation
  useFocusEffect(
    useCallback(() => {
      if (!user || !lastViewedConversationRef.current) return;

      const conversationId = lastViewedConversationRef.current;
      
      // Optimistically clear the unread count in local state
      setConversations(prevConvos => 
        prevConvos.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              unreadCounts: {
                ...conv.unreadCounts,
                [user.uid]: 0
              }
            };
          }
          return conv;
        })
      );

      console.log(`✅ Optimistically cleared unread count for conversation: ${conversationId}`);

      // Clear the ref after handling
      lastViewedConversationRef.current = null;
    }, [user])
  );

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

  const handleOpenProfile = useCallback(() => {
    // Populate edit fields with current values
    setEditedFirstName(userProfile?.firstName || '');
    setEditedLastName(userProfile?.lastName || '');
    setEditedEmail(userProfile?.email || '');
    setIsEditingProfile(false);
    setShowProfileMenu(true);
  }, [userProfile]);

  const handleSaveProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const { updateUserProfile } = await import('../../services/authService');
      await updateUserProfile(user.uid, {
        firstName: editedFirstName.trim(),
        lastName: editedLastName.trim(),
        email: editedEmail.trim() || undefined,
      });
      
      setIsEditingProfile(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    }
  }, [user, editedFirstName, editedLastName, editedEmail]);

  const handleCancelEdit = useCallback(() => {
    // Revert to original values
    setEditedFirstName(userProfile?.firstName || '');
    setEditedLastName(userProfile?.lastName || '');
    setEditedEmail(userProfile?.email || '');
    setIsEditingProfile(false);
  }, [userProfile]);

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
    const unreadCount = item.unreadCounts?.[user.uid] || 0;
    const otherUserId = item.type === 'direct' 
      ? item.participants.find(id => id !== user.uid)
      : null;
    const isOnline = otherUserId ? presenceMap[otherUserId]?.online : false;
    const isInApp = otherUserId ? presenceMap[otherUserId]?.inApp : false;

    const panGesture = useMemo(() => Gesture.Pan()
      .activeOffsetX([-10, 10]) // Require 10px horizontal movement to activate
      .failOffsetY([-10, 10]) // Fail if vertical movement exceeds 10px (prioritize scrolling)
      .onUpdate((event) => {
        'worklet';
        // Only allow left swipe (negative translation) and limit to -80px
        if (event.translationX < 0) {
          translateX.value = Math.max(event.translationX, -80);
        }
      })
      .onEnd((event) => {
        'worklet';
        if (event.translationX < -40) {
          // Threshold reached - reveal delete button (lowered to 40px for easier access)
          translateX.value = withSpring(-80);
        } else {
          // Snap back
          translateX.value = withSpring(0);
        }
      }), []);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
      backgroundColor: '#fff', // Cover the delete button when not swiped
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
        // Close if swiped - don't navigate
        translateX.value = withSpring(0);
      } else if (!isNavigating) {
        // Ensure swipe is fully closed before navigating
        translateX.value = 0;
        
        // Store conversation ID for optimistic unread clearing when returning
        lastViewedConversationRef.current = item.id;
        
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
                  <View 
                    style={[
                      styles.onlineIndicator, 
                      { backgroundColor: isInApp ? '#34C759' : '#FFD60A' }
                    ]} 
                  />
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
                    {(() => {
                      // Check if there's actual text content
                      if (item.lastMessage?.text && item.lastMessage.text.trim() !== '') {
                        return item.lastMessage.text;
                      }
                      
                      // Check if there's a valid timestamp (meaning messages were sent)
                      const timestamp = item.lastMessage?.timestamp;
                      if (timestamp) {
                        const time = typeof timestamp.getTime === 'function' ? timestamp.getTime() : 0;
                        // Check if it's a real message time (not just initialization)
                        // Messages sent in the last 10 years would be > this value
                        if (time > new Date('2015-01-01').getTime()) {
                          return 'Photo';
                        }
                      }
                      
                      return 'Start a conversation';
                    })()}
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

  // Format contact info for profile modal
  const contactInfo = userProfile?.email || 
                     (userProfile?.phoneNumber ? formatPhoneNumber(userProfile.phoneNumber) : '');

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>Go to Contacts to start chatting</Text>
          </View>
        }
      />

      {/* Apple-Style Profile Modal */}
      <Modal
        visible={showProfileMenu}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          handleCancelEdit();
          setShowProfileMenu(false);
        }}
      >
        <View style={styles.appleModalContainer}>
          {/* Header */}
          <View style={styles.appleModalHeader}>
            <TouchableOpacity 
              onPress={() => {
                handleCancelEdit();
                setShowProfileMenu(false);
              }}
              style={styles.appleHeaderButton}
            >
              <Text style={styles.appleHeaderButtonText}>Done</Text>
            </TouchableOpacity>
            
            {!isEditingProfile && (
              <TouchableOpacity 
                onPress={() => setIsEditingProfile(true)}
                style={styles.appleHeaderButton}
              >
                <Text style={[styles.appleHeaderButtonText, styles.appleEditButton]}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.appleModalContent} contentContainerStyle={styles.appleScrollContent}>
            {/* Avatar Section */}
            <View style={styles.appleAvatarSection}>
              <View style={styles.appleAvatar}>
                <Text style={styles.appleAvatarText}>
                  {(editedFirstName || userProfile?.firstName)?.[0]?.toUpperCase() || ''}
                  {(editedLastName || userProfile?.lastName)?.[0]?.toUpperCase() || ''}
                </Text>
              </View>
              <Text style={styles.appleDisplayName}>
                {isEditingProfile 
                  ? `${editedFirstName} ${editedLastName}`.trim() || 'Your Name' 
                  : `${userProfile?.firstName} ${userProfile?.lastName}`.trim() || 'User'}
              </Text>
            </View>

            {/* Fields Section */}
            {isEditingProfile ? (
              /* Edit Mode: Labels above inputs */
              <View style={styles.appleEditFieldsContainer}>
                {/* First Name */}
                <View style={styles.appleEditFieldGroup}>
                  <Text style={styles.appleEditFieldLabel}>First name</Text>
                  <TextInput
                    style={styles.appleEditFieldInput}
                    value={editedFirstName}
                    onChangeText={setEditedFirstName}
                    placeholder="First Name"
                    placeholderTextColor="#999"
                    autoCapitalize="words"
                    autoFocus={true}
                  />
                </View>

                {/* Last Name */}
                <View style={styles.appleEditFieldGroup}>
                  <Text style={styles.appleEditFieldLabel}>Last name</Text>
                  <TextInput
                    style={styles.appleEditFieldInput}
                    value={editedLastName}
                    onChangeText={setEditedLastName}
                    placeholder="Last Name"
                    placeholderTextColor="#999"
                    autoCapitalize="words"
                  />
                </View>

                {/* Email */}
                <View style={styles.appleEditFieldGroup}>
                  <Text style={styles.appleEditFieldLabel}>Email</Text>
                  <TextInput
                    style={styles.appleEditFieldInput}
                    value={editedEmail}
                    onChangeText={setEditedEmail}
                    placeholder="Email"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* Phone (read-only) */}
                <View style={styles.appleEditFieldGroup}>
                  <Text style={styles.appleEditFieldLabel}>Mobile</Text>
                  <View style={[styles.appleEditFieldInput, styles.appleReadOnlyField]}>
                    <Text style={styles.appleReadOnlyFieldText}>
                      {userProfile?.phoneNumber ? formatPhoneNumber(userProfile.phoneNumber) : 'Not set'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              /* View Mode: Only values, no labels - clickable to edit */
              <View style={styles.appleViewFieldsContainer}>
                <TouchableOpacity 
                  style={styles.appleViewFieldRow}
                  onPress={() => setIsEditingProfile(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.appleViewFieldValue}>{userProfile?.firstName || 'Not set'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.appleViewFieldRow}
                  onPress={() => setIsEditingProfile(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.appleViewFieldValue}>{userProfile?.lastName || 'Not set'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.appleViewFieldRow}
                  onPress={() => setIsEditingProfile(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.appleViewFieldValue}>{userProfile?.email || 'Not set'}</Text>
                </TouchableOpacity>
                <View style={styles.appleViewFieldRow}>
                  <Text style={[styles.appleViewFieldValue, styles.appleViewFieldReadOnly]}>
                    {userProfile?.phoneNumber ? formatPhoneNumber(userProfile.phoneNumber) : 'Not set'}
                  </Text>
                </View>
              </View>
            )}

            {/* Bottom Actions */}
            <View style={styles.appleBottomActions}>
              {isEditingProfile ? (
                <TouchableOpacity 
                  style={styles.appleSaveChangesButton}
                  onPress={handleSaveProfile}
                >
                  <Text style={styles.appleSaveChangesButtonText}>Save Changes</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.appleSignOutButton}
                  onPress={() => {
                    setShowProfileMenu(false);
                    handleSignOut();
                  }}
                >
                  <Text style={styles.appleSignOutButtonText}>Sign Out</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Apple-Style Profile Modal
  appleModalContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  appleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#F2F2F7',
    borderBottomWidth: 0.5,
    borderBottomColor: '#C6C6C8',
  },
  appleHeaderButton: {
    padding: 4,
  },
  appleHeaderButtonText: {
    fontSize: 17,
    color: '#007AFF',
  },
  appleSaveButton: {
    fontWeight: '600',
  },
  appleEditButton: {
    fontWeight: '400',
  },
  appleModalContent: {
    flex: 1,
  },
  appleScrollContent: {
    paddingBottom: 40,
  },
  appleAvatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#F2F2F7',
  },
  appleAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appleAvatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '400',
  },
  appleDisplayName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#000',
  },
  // Edit Mode Styles
  appleEditFieldsContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  appleEditFieldGroup: {
    marginBottom: 24,
  },
  appleEditFieldLabel: {
    fontSize: 13,
    color: '#000',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  appleEditFieldInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 17,
    color: '#000',
    borderWidth: 0.5,
    borderColor: '#C6C6C8',
  },
  appleReadOnlyField: {
    backgroundColor: '#F2F2F7',
  },
  appleReadOnlyFieldText: {
    fontSize: 17,
    color: '#666',
  },
  // View Mode Styles
  appleViewFieldsContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#C6C6C8',
    marginTop: 24,
  },
  appleViewFieldRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#C6C6C8',
  },
  appleViewFieldValue: {
    fontSize: 17,
    color: '#000',
  },
  appleViewFieldReadOnly: {
    color: '#666',
  },
  appleBottomActions: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    marginTop: 32,
  },
  appleSignOutButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  appleSignOutButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  appleSaveChangesButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  appleSaveChangesButtonText: {
    color: '#fff',
    fontSize: 17,
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
    // backgroundColor set dynamically: green (#34C759) if in app, yellow (#FFD60A) if online but not in app
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
    backgroundColor: '#FFCCCB',
    borderRadius: 10, 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    marginLeft: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadText: { 
    color: '#CC0000',
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

