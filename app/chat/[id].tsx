import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, FlatList, Alert, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { useAuth } from '../../store/AuthContext';
import { formatPhoneNumber } from '../../utils/phoneFormat';
import { subscribeToMessages, sendMessage, sendMessageWithTimeout, sendImageMessage, markMessagesAsRead, markMessageAsDelivered } from '../../services/messageService';
import { updateConversationLastMessage, addParticipantToConversation, removeParticipantFromConversation, resetUnreadCount } from '../../services/conversationService';
import { cacheMessage, getCachedMessages } from '../../services/sqliteService';
import { queueMessage, removeFromQueue } from '../../services/offlineQueue';
import { searchAllUsers, getUserContacts } from '../../services/contactService';
import { subscribeToUserPresence } from '../../services/presenceService';
import { pickAndUploadImage } from '../../services/imageService';
import { setActiveConversation as setFirestoreActiveConversation } from '../../services/notificationService';
import { setActiveConversation as setLocalActiveConversation } from '../../services/globalMessageListener';
import { useTypingIndicator, useTypingStatus } from '../../hooks/useTypingIndicator';
import { v4 as uuidv4 } from 'uuid';
import NetInfo from '@react-native-community/netinfo';
import { Message } from '../../types';
import { Ionicons } from '@expo/vector-icons';

interface Participant {
  uid: string;
  displayName: string;
}

interface SearchResult {
  uid: string;
  displayName: string;
  phoneNumber: string;
  initials: string;
}

// No separate SwipeableMessage component - container-level swipe instead

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const navigation = useNavigation();
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [addSearchText, setAddSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentParticipants, setCurrentParticipants] = useState<Participant[]>([]);
  const [pendingParticipants, setPendingParticipants] = useState<SearchResult[]>([]); // Users selected but not yet added
  const [participantsToRemove, setParticipantsToRemove] = useState<string[]>([]); // UIDs of participants to remove
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserInApp, setOtherUserInApp] = useState(false);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<Date | undefined>();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const conversationId = id as string;
  const flatListRef = useRef<FlatList>(null);
  
  // Container-level swipe for all blue bubbles
  const blueBubblesTranslateX = useSharedValue(0);
  
  // Typing indicators
  const { updateTypingStatus } = useTypingIndicator(
    conversationId,
    user?.uid || '',
    userProfile?.displayName || '',
    inputText.trim().length > 0
  );
  const { typingText } = useTypingStatus(conversationId, user?.uid || '');

  const [participantDetailsMap, setParticipantDetailsMap] = useState<Record<string, any>>({});
  const [isGroupChat, setIsGroupChat] = useState(false);

  // Load conversation details and participants
  useEffect(() => {
    if (!user) return;

    const loadConversationTitle = async () => {
      try {
        const { getConversation } = await import('../../services/conversationService');
        const conversation = await getConversation(conversationId);
        if (conversation) {
          // Check if group chat (3+ participants)
          setIsGroupChat(conversation.participants.length >= 3);
          
          // Store participant details for all participants (including sender info)
          setParticipantDetailsMap(conversation.participantDetails);
          
          // Store current participants
          const participants: Participant[] = conversation.participants
            .filter(id => id !== user.uid)
            .map(id => ({
              uid: id,
              displayName: conversation.participantDetails[id]?.displayName || 'Unknown'
            }));
          setCurrentParticipants(participants);

          // Set title based on mode
          let title = '';
          let subtitle = '';
          if (conversation.type === 'direct') {
            const otherUserId = conversation.participants.find(id => id !== user.uid);
            title = conversation.participantDetails[otherUserId!]?.displayName || 'Chat';
            
            // Add presence status with staleness detection
            // If lastSeen is older than 22 seconds, consider user offline (handles force-quit)
            // 22s = 1.5x heartbeat interval (15s) for reliable detection
            const secondsAgo = otherUserLastSeen 
              ? Math.floor((new Date().getTime() - otherUserLastSeen.getTime()) / 1000)
              : Infinity;
            const isStale = secondsAgo >= 22;
            
            if (otherUserOnline && otherUserInApp && !isStale) {
              subtitle = 'online'; // Green indicator - actively using app
            } else if (otherUserOnline && !otherUserInApp && !isStale) {
              subtitle = 'background'; // Yellow indicator - app in background but still connected
            } else if (otherUserLastSeen) {
              // Offline or stale - show last seen
              const minutesAgo = Math.floor(secondsAgo / 60);
              if (secondsAgo < 60) {
                subtitle = 'Last seen just now';
              } else if (minutesAgo < 60) {
                subtitle = `Last seen ${minutesAgo}m ago`;
              } else if (minutesAgo < 1440) {
                subtitle = `Last seen ${Math.floor(minutesAgo / 60)}h ago`;
              } else {
                subtitle = `Last seen ${Math.floor(minutesAgo / 1440)}d ago`;
              }
            }
          } else {
            const names = conversation.participants
              .filter(id => id !== user.uid)
              .map(id => conversation.participantDetails[id]?.displayName.split(' ')[0])
              .slice(0, 3)
              .join(', ');
            title = names + (conversation.participants.length > 4 ? '...' : '');
            subtitle = `${conversation.participants.length} participants`;
          }

          // Determine button based on state
          const hasPendingChanges = isAddMode && (pendingParticipants.length > 0 || participantsToRemove.length > 0);
          const buttonAction = hasPendingChanges ? handleConfirmAddUsers : (isAddMode ? handleCancelAdd : handleAddParticipant);

          navigation.setOptions({
            title: isAddMode ? '' : title,
            headerBackTitle: 'Messages',
            headerTitle: isAddMode || conversation.type !== 'direct' ? undefined : () => (
              <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 17, fontWeight: '600', marginRight: 6 }}>
                    {title}
                  </Text>
                  {(() => {
                    // Check staleness before showing indicator (22s threshold)
                    const secondsAgo = otherUserLastSeen 
                      ? Math.floor((new Date().getTime() - otherUserLastSeen.getTime()) / 1000)
                      : Infinity;
                    const isStale = secondsAgo >= 22;
                    
                    return otherUserOnline && !isStale && (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: otherUserInApp ? '#34C759' : '#FFD60A', // Green if in app, yellow if background
                        }}
                      />
                    );
                  })()}
                </View>
                {subtitle && (
                  <Text style={{ fontSize: 12, color: '#666' }}>
                    {subtitle}
                  </Text>
                )}
              </View>
            ),
            headerRight: () => (
              <TouchableOpacity 
                onPress={buttonAction} 
                style={{ 
                  marginRight: 12,
                  width: 32,
                  height: 32,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons 
                  name={isAddMode ? (hasPendingChanges ? "checkmark" : "close") : "person-add-outline"} 
                  size={24} 
                  color="#007AFF" 
                />
              </TouchableOpacity>
            ),
          });
        }
      } catch (error) {
        console.error('Failed to load conversation:', error);
        navigation.setOptions({ title: 'Chat', headerBackTitle: 'Messages' });
      }
    };
    loadConversationTitle();

    // Load cached messages first
    getCachedMessages(conversationId).then(cachedMsgs => {
      if (cachedMsgs.length > 0) {
        setMessages(cachedMsgs);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
      }
    }).catch(error => {
      console.error('Failed to load cached messages:', error);
    });

    // Network status
    const unsubscribeNet = NetInfo.addEventListener(async (state) => {
      const wasOnline = isOnline;
      setIsOnline(!!state.isConnected);
      
      if (state.isConnected && !wasOnline) {
        // Just reconnected
        setIsReconnecting(true);
        
        // Give Firestore time to sync (2 seconds)
        setTimeout(() => {
          setIsReconnecting(false);
        }, 2000);
      }
    });

    // Subscribe to real-time messages
    const unsubscribeMessages = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      
      // Cache messages
      msgs.forEach(m => {
        cacheMessage(m).catch(error => {
          console.error('Failed to cache message:', error);
        });
      });
      
      // Mark messages as delivered
      msgs.filter(m => m.senderId !== user!.uid && !m.deliveredTo.includes(user!.uid))
        .forEach(m => markMessageAsDelivered(conversationId, m.id, user!.uid));
      
      // Mark all unread messages as read (no flag - being in chat = messages are read)
      const unreadMessages = msgs.filter(m => 
        m.senderId !== user!.uid &&           // Not from me
        !m.readBy.includes(user!.uid)         // I haven't read it yet
      );
      
      if (unreadMessages.length > 0) {
        markMessagesAsRead(conversationId, user!.uid, unreadMessages.map(m => m.id));
        console.log(`✅ Marked ${unreadMessages.length} message(s) as read in active chat`);
      }
    });

    return () => {
      unsubscribeNet();
      unsubscribeMessages();
    };
  }, [conversationId, user, isAddMode, navigation, otherUserOnline, otherUserInApp, otherUserLastSeen, pendingParticipants, participantsToRemove, isOnline]);

  // Subscribe to presence for direct conversations
  useEffect(() => {
    if (!user) return;

    const setupPresence = async () => {
      try {
        const { getConversation } = await import('../../services/conversationService');
        const conversation = await getConversation(conversationId);
        
        if (conversation && conversation.type === 'direct') {
          const otherUserId = conversation.participants.find(id => id !== user.uid);
          if (otherUserId) {
            // Subscribe to other user's presence
            const unsubscribe = subscribeToUserPresence(otherUserId, (online, inApp, lastSeen) => {
              setOtherUserOnline(online);
              setOtherUserInApp(inApp);
              setOtherUserLastSeen(lastSeen);
            });
            return unsubscribe;
          }
        }
      } catch (error) {
        console.error('Failed to setup presence:', error);
      }
    };

    const unsubscribePromise = setupPresence();

    return () => {
      unsubscribePromise.then(unsub => unsub?.());
    };
  }, [conversationId, user]);

  // Set active conversation for smart notifications and reset unread count
  useEffect(() => {
    if (!user) return;

    // Small delay to ensure navigation has completed
    const setupTimeout = setTimeout(() => {
      // Reset unread count when entering chat
      resetUnreadCount(conversationId, user.uid).catch(error => {
        console.error('Failed to reset unread count:', error);
      });

      // Set this conversation as active in Firestore (for Cloud Functions)
      setFirestoreActiveConversation(user.uid, conversationId).catch(error => {
        console.error('Failed to set Firestore active conversation:', error);
      });

      // Set this conversation as active locally (for in-app notifications)
      setLocalActiveConversation(conversationId);
      console.log(`✅ Set active conversation: ${conversationId}`);
    }, 100);

    // Clear on unmount (when leaving this chat)
    return () => {
      clearTimeout(setupTimeout);
      
      // Clear Firestore active conversation
      setFirestoreActiveConversation(user.uid, null).catch(error => {
        console.error('Failed to clear Firestore active conversation:', error);
      });
      setLocalActiveConversation(null);
      
      // Reset unread count again on exit to ensure it's cleared before Messages page shows
      resetUnreadCount(conversationId, user.uid).catch(error => {
        console.error('Failed to reset unread count on exit:', error);
      });
      
      console.log('✅ Cleared active conversation and unread count');
    };
  }, [conversationId, user]);

  // Search for users when in add mode
  useEffect(() => {
    if (!isAddMode || !addSearchText.trim() || !user) {
      setSearchResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      try {
        // Search ALL app users (not just contacts) with fuzzy matching
        const users = await searchAllUsers(addSearchText, user.uid, 10);
        
        // Filter out current participants and format results
        const results = users
          .filter(u => !currentParticipants.find(p => p.uid === u.uid))
          .map(u => ({
            uid: u.uid,
            displayName: u.displayName || `${u.firstName} ${u.lastName}`,
            phoneNumber: u.phoneNumber || '',
            initials: u.initials || u.displayName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??',
          }));
        
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [addSearchText, currentParticipants, user, isAddMode]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !user) return;

    const localId = uuidv4();
    const tempMessage: Message = {
      id: localId,
      conversationId,
      text: inputText.trim(),
      senderId: user.uid,
      timestamp: new Date(),
      status: 'sending',
      type: 'text',
      localId,
      readBy: [user.uid],
      deliveredTo: []
    };

    // 1. QUEUE FIRST (pessimistic - guarantees persistence)
    await queueMessage({
      conversationId,
      text: tempMessage.text,
      senderId: user.uid,
      localId
    });
    console.log('📦 Message queued first for persistence');

    // 2. Show optimistically in UI
    setMessages(prev => [...prev, tempMessage]);
    setInputText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // 3. Cache immediately
    await cacheMessage(tempMessage);

    // 4. Try to send (only if online)
    if (isOnline) {
      try {
        // Use timeout version (10 second limit)
        await sendMessageWithTimeout(conversationId, tempMessage.text, user.uid, localId, undefined, 10000);
        await updateConversationLastMessage(conversationId, tempMessage.text, user.uid, localId);
        
        // 5. SUCCESS: Remove from queue
        await removeFromQueue(localId);
        console.log(`✅ Message sent and removed from queue: ${localId}`);
        
        // Update UI to show "sent" status
        setMessages(prev => prev.map(m => 
          m.localId === localId ? { ...m, status: 'sent' } : m
        ));
        
      } catch (error: any) {
        console.log(`⚠️ Send failed, message stays in queue: ${localId}`);
        // Message stays in queue for automatic retry on reconnect
        
        // Update UI to show "queued" status
        setMessages(prev => prev.map(m => 
          m.localId === localId ? { ...m, status: 'queued' } : m
        ));
        
        // Show user feedback for timeout
        if (error.message && error.message.includes('timeout')) {
          Alert.alert(
            'Slow Connection',
            'Message will send when connection improves',
            [{ text: 'OK' }]
          );
        }
      }
    } else {
      // Offline - message already queued, just update status
      console.log('📤 Offline: Message queued for later sending');
      setMessages(prev => prev.map(m => 
        m.localId === localId ? { ...m, status: 'queued' } : m
      ));
    }
  }, [inputText, conversationId, user, isOnline]);

  // Format read receipt like iMessage - shows when message was READ, not sent
  const formatReadReceipt = (message: Message): string | null => {
    if (!message.readBy || message.readBy.length <= 1) return null;
    
    // Get the latest read timestamp (excluding sender)
    const otherReaders = message.readBy.filter(uid => uid !== user?.uid);
    if (otherReaders.length === 0) return null;
    
    // TODO: Track actual readAt timestamp in Message type
    // For now, use timestamp + 1 minute as approximation
    // In production, add readAt field to track when user actually opened the chat
    const readTime = new Date(message.timestamp.getTime() + 60000);
    const now = new Date();
    
    if (isToday(readTime)) {
      return `Read ${format(readTime, 'h:mm a')}`;
    } else if (isYesterday(readTime)) {
      return 'Read Yesterday';
    } else {
      const daysDiff = Math.floor((now.getTime() - readTime.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < 7) {
        return `Read ${format(readTime, 'EEEE')}`;  // "Read Monday"
      } else {
        return `Read ${format(readTime, 'M/d/yy')}`;
      }
    }
  };

  // Container-level pan gesture for all blue bubbles (memoized to prevent recreation)
  const containerPanGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-10, 10]) // Require 10px horizontal movement to activate
    .failOffsetY([-10, 10]) // Fail if vertical movement exceeds 10px (allow scrolling)
    .onUpdate((event) => {
      'worklet';
      // Only allow left swipe (negative translation)
      if (event.translationX < 0) {
        blueBubblesTranslateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationX < -60) {
        // Reveal all timestamps
        blueBubblesTranslateX.value = withSpring(-100);
      } else {
        // Hide timestamps
        blueBubblesTranslateX.value = withSpring(0);
      }
    }), [blueBubblesTranslateX]);

  // Animated style for all blue bubbles
  const blueBubblesAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: blueBubblesTranslateX.value }],
  }));

  // Get sender info for group chats (memoized)
  const getSenderInfo = useCallback((senderId: string) => {
    const details = participantDetailsMap[senderId];
    if (!details) return null;
    
    const displayName = details.displayName || 'Unknown';
    const initials = details.initials || displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    
    return { displayName, initials };
  }, [participantDetailsMap]);

  const handlePickImage = async () => {
    if (!user) return;

    try {
      setIsUploadingImage(true);
      
      // Pick and upload image
      const imageUrl = await pickAndUploadImage(conversationId);
      
      if (!imageUrl) {
        // User cancelled or error occurred
        setIsUploadingImage(false);
        return;
      }

      // Send image message
      const localId = uuidv4();
      const tempMessage: Message = {
        id: localId,
        conversationId,
        text: 'Image',
        senderId: user.uid,
        timestamp: new Date(),
        status: 'sent',
        type: 'image',
        mediaURL: imageUrl,
        localId,
        readBy: [user.uid],
        deliveredTo: []
      };

      // Add to messages
      setMessages(prev => [...prev, tempMessage]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      // Send to server
      if (isOnline) {
        await sendImageMessage(conversationId, imageUrl, user.uid, localId);
        await updateConversationLastMessage(conversationId, '📷 Image', user.uid, localId);
      } else {
        await queueMessage({
          conversationId,
          text: 'Image',
          senderId: user.uid,
          localId
        });
      }

      setIsUploadingImage(false);
    } catch (error: any) {
      console.error('Failed to send image:', error);
      Alert.alert('Error', 'Failed to send image. Please try again.');
      setIsUploadingImage(false);
    }
  };

  const handleAddParticipant = () => {
    setIsAddMode(true);
    setPendingParticipants([]); // Clear pending when entering add mode
    setParticipantsToRemove([]); // Clear removal list
  };

  const handleCancelAdd = () => {
    setIsAddMode(false);
    setAddSearchText('');
    setSearchResults([]);
    setPendingParticipants([]); // Discard pending changes
    setParticipantsToRemove([]); // Discard removals
  };

  const handleRemoveExistingParticipant = (uid: string) => {
    // Toggle removal state
    setParticipantsToRemove(prev => 
      prev.includes(uid) 
        ? prev.filter(id => id !== uid) // Un-mark for removal
        : [...prev, uid] // Mark for removal
    );
  };

  const handleSelectUser = (selectedUser: SearchResult) => {
    // Add to pending list (not immediately to conversation)
    setPendingParticipants(prev => {
      const exists = prev.find(p => p.uid === selectedUser.uid);
      if (exists) return prev; // Don't add duplicates
      return [...prev, selectedUser];
    });
    
    // Clear search
    setAddSearchText('');
    setSearchResults([]);
  };

  const handleConfirmAddUsers = async () => {
    if (pendingParticipants.length === 0 && participantsToRemove.length === 0) {
      setIsAddMode(false);
      return;
    }

    try {
      // Calculate new participant list
      const currentParticipantIds = currentParticipants.map(p => p.uid);
      const allParticipantIds = Array.from(new Set([
        user.uid, // Always include current user
        ...currentParticipantIds.filter(id => !participantsToRemove.includes(id)), // Remove marked
        ...pendingParticipants.map(p => p.uid) // Add new
      ]));

      // Check if participants are changing and if we should split
      const isChangingParticipants = pendingParticipants.length > 0 || participantsToRemove.length > 0;
      
      if (isChangingParticipants) {
        // Import splitting functions
        const { shouldSplitOnParticipantAdd, splitConversation, getConversation } = 
          await import('../../services/conversationService');
        
        const shouldSplit = await shouldSplitOnParticipantAdd(conversationId);
        
        if (shouldSplit) {
          // Show confirmation dialog
          Alert.alert(
            'Create New Conversation?',
            'Changing participants will create a new conversation. Previous messages will remain in the old conversation.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  // Reset state
                  setPendingParticipants([]);
                  setParticipantsToRemove([]);
                }
              },
              {
                text: 'Continue',
                onPress: async () => {
                  try {
                    // Split conversation
                    const newConversationId = await splitConversation(
                      conversationId,
                      allParticipantIds,
                      user.uid
                    );
                    
                    // Navigate to new conversation
                    router.replace(`/chat/${newConversationId}`);
                    
                    // Reset state
                    setIsAddMode(false);
                    setAddSearchText('');
                    setSearchResults([]);
                    setPendingParticipants([]);
                    setParticipantsToRemove([]);
                  } catch (error: any) {
                    Alert.alert('Error', error.message);
                  }
                }
              }
            ]
          );
          return;
        }
      }

      // No split needed - just add/remove participants
      // Remove marked participants
      for (const uid of participantsToRemove) {
        await removeParticipantFromConversation(conversationId, uid);
        
        // Remove from current participants list
        setCurrentParticipants(prev => prev.filter(p => p.uid !== uid));
      }

      // Add all pending participants
      for (const participant of pendingParticipants) {
        await addParticipantToConversation(conversationId, participant.uid);
        
        // Add to current participants list
        setCurrentParticipants(prev => [...prev, {
          uid: participant.uid,
          displayName: participant.displayName
        }]);
      }
      
      // Reset add mode - no success toast
      setIsAddMode(false);
      setAddSearchText('');
      setSearchResults([]);
      setPendingParticipants([]);
      setParticipantsToRemove([]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // Manual retry handler for queued messages
  const handleRetryMessage = useCallback(async (localId: string) => {
    try {
      const { getQueue } = await import('../services/offlineQueue');
      const queue = await getQueue();
      const message = queue.find(m => m.localId === localId);
      
      if (!message) {
        Alert.alert('Error', 'Message not found in queue');
        return;
      }
      
      // Show loading
      setMessages(prev =>
        prev.map(msg =>
          msg.localId === localId || msg.id === localId
            ? { ...msg, status: 'sending' }
            : msg
        )
      );
      
      // Try to send with timeout
      await sendMessageWithTimeout(
        message.conversationId,
        message.text,
        message.senderId,
        localId,
        undefined,
        10000
      );
      
      // Success: remove from queue
      await removeFromQueue(localId);
      
      // Update UI
      setMessages(prev =>
        prev.map(msg =>
          msg.localId === localId || msg.id === localId
            ? { ...msg, status: 'sent' }
            : msg
        )
      );
      
      Alert.alert('✅ Sent', 'Message sent successfully');
      
    } catch (error) {
      console.error('Manual retry failed:', error);
      
      // Update UI back to queued
      setMessages(prev =>
        prev.map(msg =>
          msg.localId === localId || msg.id === localId
            ? { ...msg, status: 'queued' }
            : msg
        )
      );
      
      Alert.alert(
        'Retry Failed',
        'Message will be retried automatically when online'
      );
    }
  }, []);

  // Memoized MessageRow component for FlatList performance
  const MessageRow = memo(({ item: message, index }: { item: Message; index: number }) => {
    const isOwnMessage = message.senderId === user!.uid;
    const isImageMessage = message.type === 'image' && message.mediaURL;
    const readReceipt = isOwnMessage ? formatReadReceipt(message) : null;
    const isLastInGroup = index === messages.length - 1 || messages[index + 1]?.senderId !== message.senderId;
    const isFirstInGroup = index === 0 || messages[index - 1]?.senderId !== message.senderId;
    const formattedTime = format(message.timestamp, 'h:mm a');
    
    // Get sender info for group chats
    const senderInfo = !isOwnMessage && isGroupChat ? getSenderInfo(message.senderId) : null;
    
    return (
      <View style={styles.messageRow}>
        {isOwnMessage ? (
          // Blue bubbles: All move together with container gesture
          <GestureDetector gesture={containerPanGesture}>
            <Animated.View style={[styles.ownMessageWrapper, blueBubblesAnimatedStyle]}>
              <View style={styles.messageContainer}>
                <View 
                  style={[
                    styles.messageBubble,
                    styles.ownMessage,
                    isImageMessage && styles.imageMessageBubble
                  ]}
                >
                  {isImageMessage ? (
                    <TouchableOpacity onPress={() => Alert.alert('Image', 'Image viewer would open here')}>
                      <Image 
                        source={{ uri: message.mediaURL }} 
                        style={styles.messageImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.messageText, { color: '#fff' }]}>
                      {message.text}
                    </Text>
                  )}
                </View>
                
                {/* Read receipt below bubble - always visible */}
                {readReceipt && isLastInGroup && (
                  <Text style={[styles.readReceipt, styles.readReceiptOwn]}>
                    {readReceipt}
                  </Text>
                )}
                
                {/* Queued status chip */}
                {message.status === 'queued' && (
                  <View style={styles.queuedChip}>
                    <Ionicons name="time-outline" size={14} color="#FF9800" style={{ marginRight: 4 }} />
                    <Text style={styles.queuedText}>Queued</Text>
                    <TouchableOpacity 
                      onPress={() => {
                        // Call handleRetryMessage from parent scope
                        if (user) {
                          handleRetryMessage(message.localId || message.id);
                        }
                      }}
                      style={styles.retryButton}
                    >
                      <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              {/* Timestamp revealed on swipe */}
              <View style={styles.timestampRevealContainer}>
                <Text style={styles.timestampRevealText}>{formattedTime}</Text>
              </View>
            </Animated.View>
          </GestureDetector>
        ) : (
          // Grey bubbles: Fixed, no swipe
          <View style={styles.otherMessageWrapper}>
            {/* Avatar - only show for group chats and first message in group */}
            {isGroupChat && isFirstInGroup && senderInfo && (
              <View style={styles.senderAvatar}>
                <Text style={styles.senderAvatarText}>{senderInfo.initials}</Text>
              </View>
            )}
            {/* Spacer when not showing avatar */}
            {isGroupChat && !isFirstInGroup && (
              <View style={styles.avatarSpacer} />
            )}
            
            <View style={styles.messageContainer}>
              {/* Sender name - only for group chats and first message in group */}
              {isGroupChat && isFirstInGroup && senderInfo && (
                <Text style={styles.senderName}>{senderInfo.displayName}</Text>
              )}
              
              <View 
                style={[
                  styles.messageBubble,
                  styles.otherMessage,
                  isImageMessage && styles.imageMessageBubble
                ]}
              >
                {isImageMessage ? (
                  <TouchableOpacity onPress={() => Alert.alert('Image', 'Image viewer would open here')}>
                    <Image 
                      source={{ uri: message.mediaURL }} 
                      style={styles.messageImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.messageText, { color: '#000' }]}>
                    {message.text}
                  </Text>
                )}
              </View>
              
              {/* Read receipt below bubble */}
              {readReceipt && isLastInGroup && (
                <Text style={styles.readReceipt}>
                  {readReceipt}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    );
  });

  if (!user || !userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {/* Add Participant Mode */}
      {isAddMode && (
        <View style={styles.addModeContainer}>
          <View style={styles.addModeHeader}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.participantsScroll}
              contentContainerStyle={styles.participantsContent}
            >
              {/* Show existing participants (can be marked for removal) */}
              {currentParticipants
                .filter(p => p.uid !== user.uid) // Don't show current user
                .map(participant => {
                  const isMarkedForRemoval = participantsToRemove.includes(participant.uid);
                  return (
                    <View key={`current-${participant.uid}`} style={[
                      styles.participantPill,
                      isMarkedForRemoval && styles.participantPillRemoving
                    ]}>
                      <Text style={[
                        styles.participantPillText,
                        isMarkedForRemoval && styles.participantPillTextRemoving
                      ]}>
                        {participant.displayName}
                      </Text>
                      <TouchableOpacity 
                        onPress={() => handleRemoveExistingParticipant(participant.uid)}
                        style={styles.removePillButton}
                      >
                        <Text style={styles.removePillText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

              {/* Show pending participants (users selected but not yet added) */}
              {pendingParticipants.map(participant => (
                <View key={`pending-${participant.uid}`} style={[styles.participantPill, styles.participantPillPending]}>
                  <Text style={styles.participantPillText}>{participant.displayName}</Text>
                  <TouchableOpacity 
                    onPress={() => setPendingParticipants(prev => prev.filter(p => p.uid !== participant.uid))}
                    style={styles.removePillButton}
                  >
                    <Text style={styles.removePillText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TextInput
                style={styles.addSearchInput}
                value={addSearchText}
                onChangeText={setAddSearchText}
                placeholder="Type name or number..."
                placeholderTextColor="#999"
                autoFocus={true}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
                returnKeyType="search"
                editable={true}
                blurOnSubmit={false}
              />
            </ScrollView>
          </View>
          
          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <View style={styles.searchResultsDropdown}>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.uid}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResultItem}
                    onPress={() => handleSelectUser(item)}
                  >
                    <View style={styles.resultAvatar}>
                      <Text style={styles.resultAvatarText}>{item.initials}</Text>
                    </View>
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName}>{item.displayName}</Text>
                      <Text style={styles.resultPhone}>{formatPhoneNumber(item.phoneNumber)}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      )}

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            {isReconnecting ? '🔄 Reconnecting...' : '📡 No Internet Connection'}
          </Text>
        </View>
      )}

      <View style={styles.messagesWrapper}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <MessageRow item={item} index={index} />}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={true}
          removeClippedSubviews={true}
          maxToRenderPerBatch={20}
          windowSize={21}
          initialNumToRender={20}
          ListFooterComponent={() => (
            <>
              {/* Typing Indicator - inline with messages */}
              {typingText && (
                <View style={styles.messageRow}>
                  <View style={styles.messageContainer}>
                    <View style={styles.typingBubble}>
                      <View style={styles.typingDotsContainer}>
                        <View style={[styles.typingDot, styles.typingDot1]} />
                        <View style={[styles.typingDot, styles.typingDot2]} />
                        <View style={[styles.typingDot, styles.typingDot3]} />
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}
        />
      </View>

      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.imageButton}
          onPress={handlePickImage}
        >
          <Ionicons name="image-outline" size={26} color="#007AFF" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          multiline
          maxLength={1000}
        />
        <TouchableOpacity 
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  addModeContainer: {
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  addModeHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  participantsScroll: {
    flexGrow: 0,
  },
  participantsContent: {
    alignItems: 'center',
  },
  participantPill: {
    backgroundColor: '#E8E8E8',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantPillText: {
    color: '#000',
    fontSize: 15,
  },
  participantPillRemoving: {
    backgroundColor: '#FFE5E5', // Light red for removal
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  participantPillTextRemoving: {
    color: '#FF3B30',
    textDecorationLine: 'line-through',
  },
  participantPillPending: {
    backgroundColor: '#E3F2FD', // Light blue for new additions
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  removePillButton: {
    marginLeft: 6,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePillText: {
    fontSize: 20,
    color: '#666',
    fontWeight: '500',
    lineHeight: 16,
  },
  addSearchInput: {
    fontSize: 17,
    color: '#000',
    minWidth: 150,
    paddingVertical: 4,
  },
  searchResultsDropdown: {
    maxHeight: 250,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 17,
    color: '#000',
    fontWeight: '500',
    marginBottom: 2,
  },
  resultPhone: {
    fontSize: 14,
    color: '#666',
  },
  typingBubble: {
    backgroundColor: '#E8E8E8',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    maxWidth: '80%',
    marginBottom: 4,
  },
  typingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.7,
  },
  typingDot3: {
    opacity: 1,
  },
  offlineBanner: {
    backgroundColor: '#ff9800',
    padding: 10,
  },
  offlineText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  messagesWrapper: {
    flex: 1,
    overflow: 'hidden', // Hide timestamps that are positioned outside viewport
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    paddingRight: 0, // No right padding - timestamps flush with screen edge
    flexGrow: 1, // Allow content to grow beyond screen height
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'visible',
  },
  messageContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  ownMessageWrapper: {
    position: 'relative',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestampRevealContainer: {
    position: 'absolute',
    right: -80, // Reduced spacing - flush with edge when revealed
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  timestampRevealText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 2,
  },
  imageMessageBubble: {
    padding: 4,
  },
  ownMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    marginLeft: 'auto', // Push to far right
    marginRight: 8, // Small margin so bubbles don't touch screen edge
  },
  otherMessage: {
    backgroundColor: '#E8E8E8',
    alignSelf: 'flex-start',
  },
  otherMessageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  senderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  senderAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  avatarSpacer: {
    width: 28,
    marginRight: 8,
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginLeft: 4,
    fontWeight: '600',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 11,
    marginRight: 4,
  },
  messageStatus: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  readReceipt: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 4,
    alignSelf: 'flex-start', // Align with grey bubbles
  },
  readReceiptOwn: {
    textAlign: 'right',
    alignSelf: 'flex-end', // Right-adjusted under blue bubbles
    marginRight: 8, // Match bubble margin
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#D1D1D6',
    backgroundColor: '#F8F8F8',
  },
  imageButton: {
    padding: 4,
    marginLeft: 2,
    marginRight: 6,
    marginBottom: 4,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingHorizontal: 14,
    paddingVertical: 8,
    paddingTop: 9,
    marginHorizontal: 6,
    maxHeight: 100,
    minHeight: 36,
    fontSize: 17,
    lineHeight: 20,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
    height: 36,
    marginBottom: 4,
    marginLeft: 6,
    marginRight: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#C0C0C0',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  queuedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  queuedText: {
    fontSize: 12,
    color: '#FF9800',
    marginRight: 8,
  },
  retryButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  retryText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
});
