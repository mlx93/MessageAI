import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Pressable, Text, StyleSheet, KeyboardAvoidingView, Platform, FlatList, Alert, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS, withTiming } from 'react-native-reanimated';
import { useAuth } from '../../store/AuthContext';
import { formatPhoneNumber } from '../../utils/phoneFormat';
import { subscribeToMessages, sendMessage, sendMessageWithTimeout, sendImageMessage, markMessagesAsRead, markMessageAsDelivered, deleteMessage } from '../../services/messageService';
import { updateConversationLastMessage, updateConversationLastMessageBatched, addParticipantToConversation, resetUnreadCount, splitConversation } from '../../services/conversationService';
import { cacheMessage, cacheMessageBatched, getCachedMessages, flushCacheBuffer } from '../../services/sqliteService';
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
import ImageViewer from '../../components/ImageViewer';
import MessageActionSheet from '../../components/MessageActionSheet';
import CachedImage from '../../components/CachedImage';
import QueueVisibilityBanner from '../../components/QueueVisibilityBanner';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

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
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null); // Image viewer state
  const [isInputFocused, setIsInputFocused] = useState(false); // Track if input is focused
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const conversationId = id as string;
  const flatListRef = useRef<FlatList>(null);
  const hasScrolledToEnd = useRef(false); // Track if we've scrolled to end on initial load
  const prevMessageCount = useRef(0); // Track previous message count to detect NEW messages
  const lockScrollToBottom = useRef(false); // Lock scroll at bottom during image loading
  const [shouldRenderImages, setShouldRenderImages] = useState(false); // Defer image rendering until after scroll
  const lastOnlineStatusRef = useRef(isOnline);
  const layoutReadyRef = useRef(false);
  const initialDataReadyRef = useRef(false);
  const hasSnappedToBottomRef = useRef(false);
  const pendingInitialSnapRef = useRef(false);
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);
  
  const ensureInitialSnap = useCallback(() => {
    if (hasSnappedToBottomRef.current || !flatListRef.current) {
      return;
    }

    const attemptSnap = () => {
      if (!layoutReadyRef.current || !initialDataReadyRef.current) {
        return;
      }

      requestAnimationFrame(() => {
        if (!flatListRef.current) return;

        const targetOffset = Math.max(contentHeightRef.current - layoutHeightRef.current, 0);

        try {
          flatListRef.current.scrollToOffset({ offset: targetOffset, animated: false });
          flatListRef.current.scrollToEnd({ animated: false });
          hasSnappedToBottomRef.current = true;
          hasScrolledToEnd.current = true;

          setTimeout(() => {
            setShouldRenderImages(true);
            lockScrollToBottom.current = true;
            setTimeout(() => {
              lockScrollToBottom.current = false;
              requestAnimationFrame(() => {
                if (!flatListRef.current) return;
                flatListRef.current.scrollToEnd({ animated: false });
              });
            }, 2000);
          }, 50);
        } catch (error) {
          console.warn('Initial snap failed, retrying...', error);
          setTimeout(attemptSnap, 32);
        }
      });
    };

    attemptSnap();
  }, []);

  const markInitialDataReady = useCallback(() => {
    if (initialDataReadyRef.current) return;

    initialDataReadyRef.current = true;

    if (layoutReadyRef.current) {
      ensureInitialSnap();
    } else {
      pendingInitialSnapRef.current = true;
    }
  }, [ensureInitialSnap]);
  
  // Container-level swipe for all blue bubbles
  const blueBubblesTranslateX = useSharedValue(0);
  
  // Typing indicators - only show when input has text AND is focused
  const { updateTypingStatus } = useTypingIndicator(
    conversationId,
    user?.uid || '',
    userProfile?.displayName || '',
    inputText.trim().length > 0,
    isInputFocused
  );
  const { typingText, typingUsers } = useTypingStatus(conversationId, user?.uid || '');

  const [participantDetailsMap, setParticipantDetailsMap] = useState<Record<string, any>>({});
  const [isGroupChat, setIsGroupChat] = useState(false);

  // Load conversation details and participants
  useEffect(() => {
    if (!user) return;

    lastOnlineStatusRef.current = isOnline;
    layoutReadyRef.current = false;
    initialDataReadyRef.current = false;
    hasSnappedToBottomRef.current = false;
    pendingInitialSnapRef.current = false;
    hasScrolledToEnd.current = false;
    lockScrollToBottom.current = false;
    setShouldRenderImages(false);
    contentHeightRef.current = 0;
    layoutHeightRef.current = 0;

    const loadConversationData = async () => {
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
        }
      } catch (error) {
        console.error('Failed to load conversation:', error);
      }
    };
    loadConversationData();

    // Load cached messages first (newest 50 for instant display)
    getCachedMessages(conversationId).then(cachedMsgs => {
      if (cachedMsgs.length > 0) {
        // Load newest 50 messages first for instant display
        const recentMessages = cachedMsgs.slice(-50);
        setMessages(recentMessages);
      }
      markInitialDataReady();
    }).catch(error => {
      console.error('Failed to load cached messages:', error);
    });

    // Network status
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const nextOnline = !!state.isConnected;
      const wasOnline = lastOnlineStatusRef.current;
      setIsOnline(nextOnline);
      
      if (nextOnline && !wasOnline) {
        // Just reconnected
        setIsReconnecting(true);
        
        // Give Firestore time to sync (2 seconds)
        setTimeout(() => {
          setIsReconnecting(false);
        }, 2000);
      }

      lastOnlineStatusRef.current = nextOnline;
    });

    // Subscribe to real-time messages
    const unsubscribeMessages = subscribeToMessages(conversationId, (msgs) => {
      // Filter out messages deleted by current user
      const visibleMessages = msgs.filter(m => 
        !m.deletedBy || !m.deletedBy.includes(user!.uid)
      );
      
      // Check if this is a NEW message (not just an update)
      const isNewMessage = visibleMessages.length > prevMessageCount.current;
      prevMessageCount.current = visibleMessages.length;
      
      // Smart update: Only update state if messages actually changed
      // This prevents re-renders on every read receipt/delivery status update
      setMessages(prevMessages => {
        // Quick check: if lengths differ, definitely update
        if (prevMessages.length !== visibleMessages.length) {
          // Cache only NEW messages (not already in state)
          const newMsgIds = new Set(prevMessages.map(m => m.id));
          visibleMessages
            .filter(m => !newMsgIds.has(m.id))
            .forEach(m => cacheMessageBatched(m));
          
          return visibleMessages;
        }
        
        // Check if any message actually changed (status, readBy, deliveredTo)
        let hasChanges = false;
        const updatedMessages = visibleMessages.map(newMsg => {
          const oldMsg = prevMessages.find(m => m.id === newMsg.id);
          if (!oldMsg) {
            hasChanges = true;
            cacheMessageBatched(newMsg); // Cache new message
            return newMsg;
          }
          
          // Check if important fields changed
          if (oldMsg.status !== newMsg.status ||
              oldMsg.readBy.length !== newMsg.readBy.length ||
              oldMsg.deliveredTo.length !== newMsg.deliveredTo.length) {
            hasChanges = true;
            cacheMessageBatched(newMsg); // Cache changed message
            return newMsg;
          }
          
          // No change, keep old reference to prevent re-render
          return oldMsg;
        });
        
        // Only update if something changed
        return hasChanges ? updatedMessages : prevMessages;
      });
      markInitialDataReady();
      
      // Only scroll to bottom when NEW messages arrive (not on status updates)
      if (hasScrolledToEnd.current && isNewMessage) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
      
      // Mark messages as delivered
      visibleMessages.filter(m => m.senderId !== user!.uid && !m.deliveredTo.includes(user!.uid))
        .forEach(m => markMessageAsDelivered(conversationId, m.id, user!.uid));
      
      // Mark all unread messages as read (no flag - being in chat = messages are read)
      const unreadMessages = visibleMessages.filter(m => 
        m.senderId !== user!.uid &&           // Not from me
        !m.readBy.includes(user!.uid)         // I haven't read it yet
      );
      
      if (unreadMessages.length > 0) {
        markMessagesAsRead(conversationId, user!.uid, unreadMessages.map(m => m.id));
      }
    });

    return () => {
      unsubscribeNet();
      unsubscribeMessages();
    };
  }, [conversationId, user]);
  
  // Separate effect for updating header when presence/add mode changes
  // This prevents re-subscribing to messages on every presence update
  useEffect(() => {
    if (!user) return;
    
    const updateHeader = async () => {
      try {
        const { getConversation } = await import('../../services/conversationService');
        const conversation = await getConversation(conversationId);
        if (!conversation) return;
        
        // Set title based on mode
        let title = '';
        let subtitle = '';
        if (conversation.type === 'direct') {
          const otherUserId = conversation.participants.find(id => id !== user.uid);
          title = conversation.participantDetails[otherUserId!]?.displayName || 'Chat';
          
          // Add presence status with staleness detection
          const secondsAgo = otherUserLastSeen 
            ? Math.floor((new Date().getTime() - otherUserLastSeen.getTime()) / 1000)
            : Infinity;
          const isStale = secondsAgo >= 22;
          
          if (otherUserOnline && otherUserInApp && !isStale) {
            subtitle = 'online';
          } else if (otherUserOnline && !otherUserInApp && !isStale) {
            subtitle = 'background';
          } else if (otherUserLastSeen) {
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
          const count = conversation.participants.length;
          subtitle = `${count} ${count === 1 ? 'participant' : 'participants'}`;
        }

        const hasPendingChanges = isAddMode && (pendingParticipants.length > 0 || participantsToRemove.length > 0);
        const buttonAction = hasPendingChanges ? handleConfirmAddUsers : (isAddMode ? handleCancelAdd : handleAddParticipant);

        navigation.setOptions({
          title: isAddMode ? '' : title,
          headerBackTitle: '',
          headerTitle: isAddMode ? undefined : () => {
            const isGroup = conversation.type === 'group';
            const HeaderContent = (
              <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 17, fontWeight: '600', marginRight: 6 }}>
                    {title}
                  </Text>
                  {!isGroup && (() => {
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
                          backgroundColor: otherUserInApp ? '#34C759' : '#FFD60A',
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
            );

            return isGroup ? (
              <TouchableOpacity onPress={() => router.push(`/group/${conversationId}`)}>
                {HeaderContent}
              </TouchableOpacity>
            ) : HeaderContent;
          },
          headerRight: () => (
            <TouchableOpacity 
              onPress={buttonAction} 
              style={{ 
                marginRight: 4,
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
      } catch (error) {
        console.error('Failed to update header:', error);
      }
    };
    
    updateHeader();
  }, [conversationId, user, isAddMode, otherUserOnline, otherUserInApp, otherUserLastSeen, pendingParticipants, participantsToRemove]);

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
      
      // Flush any pending cache writes before leaving
      flushCacheBuffer().catch(error => {
        console.error('Failed to flush cache buffer:', error);
      });
      
      // Clear Firestore active conversation
      setFirestoreActiveConversation(user.uid, null).catch(error => {
        console.error('Failed to clear Firestore active conversation:', error);
      });
      setLocalActiveConversation(null);
      
      // Reset unread count again on exit to ensure it's cleared before Messages page shows
      resetUnreadCount(conversationId, user.uid).catch(error => {
        console.error('Failed to reset unread count on exit:', error);
      });
      
      if (__DEV__) console.log('✅ Flushed cache, cleared active conversation and unread count');
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
        localId,
        type: 'text'
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
        updateConversationLastMessageBatched(conversationId, tempMessage.text, user.uid, localId);
        
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

  // Format read receipt like iMessage - shows when message was READ, not sent (memoized)
  const formatReadReceipt = useCallback((message: Message): string | null => {
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
  }, [user]);

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
    const initials = details.initials || displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    
    return { displayName, initials };
  }, [participantDetailsMap]);

  const handlePickImage = async () => {
    if (!user) return;

    try {
      setIsUploadingImage(true);
      
      // Pick and upload image
      const imageUrl = await pickAndUploadImage(conversationId);
      
      if (!imageUrl) {
        return;
      }

      // Queue first for persistence
      const localId = uuidv4();
      const tempMessage: Message = {
        id: localId,
        conversationId,
        text: 'Image',
        senderId: user.uid,
        timestamp: new Date(),
        status: 'sending',
        type: 'image',
        mediaURL: imageUrl,
        localId,
        readBy: [user.uid],
        deliveredTo: []
      };

      await queueMessage({
        conversationId,
        text: tempMessage.text,
        senderId: user.uid,
        localId,
        mediaURL: imageUrl,
        type: 'image'
      });
      console.log('📦 Image message queued first for persistence');

      // Optimistically show in UI and cache
      setMessages(prev => [...prev, tempMessage]);
      await cacheMessage(tempMessage);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      if (isOnline) {
        try {
          await sendImageMessage(conversationId, imageUrl, user.uid, localId);
          updateConversationLastMessageBatched(conversationId, '📷 Image', user.uid, localId);

          await removeFromQueue(localId);
          setMessages(prev => prev.map(m => 
            m.localId === localId || m.id === localId
              ? { ...m, status: 'sent' }
              : m
          ));
        } catch (error: any) {
          console.log(`⚠️ Image send failed, message stays in queue: ${localId}`);
          setMessages(prev => prev.map(m => 
            m.localId === localId || m.id === localId
              ? { ...m, status: 'queued' }
              : m
          ));

          const isTimeout = error?.message?.includes('timeout');
          Alert.alert(
            isTimeout ? 'Slow Connection' : 'Image Queued',
            isTimeout
              ? 'Image will send when connection improves'
              : 'Image will be retried automatically when online'
          );
        }
      } else {
        console.log('📤 Offline: Image message queued for later sending');
        setMessages(prev => prev.map(m => 
          m.localId === localId || m.id === localId
            ? { ...m, status: 'queued' }
            : m
        ));
      }
    } catch (error: any) {
      console.error('Failed to send image:', error);
      Alert.alert('Error', 'Failed to send image. Please try again.');
    } finally {
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
    if (!user) return;
    
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
        
        // ALWAYS split when removing participants, otherwise check if adding requires split
        const shouldSplit = participantsToRemove.length > 0 || await shouldSplitOnParticipantAdd(conversationId);
        
        if (shouldSplit) {
          // Show confirmation dialog with appropriate message
          const message = participantsToRemove.length > 0
            ? 'Removing participants will create a new conversation with the remaining people. The original conversation will be preserved.'
            : 'Adding participants will create a group conversation. The original conversation will be preserved.';
          
          Alert.alert(
            'Create New Conversation?',
            message,
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
                    // Split conversation (creates new or finds existing with remaining participants)
                    const newConversationId = await splitConversation(
                      conversationId,
                      allParticipantIds,
                      user!.uid // Safe: user checked at start of handleConfirmAddUsers
                    );
                    
                    // Navigate to new/existing conversation
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

      // No split needed - just add participants (removal always requires split above)
      // Add all pending participants
      if (pendingParticipants.length > 0) {
        await Promise.all(
          pendingParticipants.map(participant => 
            addParticipantToConversation(conversationId, participant.uid)
          )
        );

        setCurrentParticipants(prev => {
          const existingIds = new Set(prev.map(p => p.uid));
          const additions = pendingParticipants
            .filter(participant => !existingIds.has(participant.uid))
            .map(participant => ({
              uid: participant.uid,
              displayName: participant.displayName
            }));
          return [...prev, ...additions];
        });
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

  // Action sheet handlers
  const handleLongPressMessage = useCallback((message: Message) => {
    setSelectedMessage(message);
    setActionSheetVisible(true);
  }, []);

  // Stable onLayout callback for FlatList
  const handleFlatListLayout = useCallback((event?: any) => {
    if (event?.nativeEvent?.layout?.height) {
      layoutHeightRef.current = event.nativeEvent.layout.height;
    }
    layoutReadyRef.current = true;
    if (initialDataReadyRef.current) {
      ensureInitialSnap();
    } else {
      requestAnimationFrame(() => ensureInitialSnap());
    }
  }, [ensureInitialSnap]);

  // Handle content size change - keep at bottom if locked (during initial image loading)
  const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
    contentHeightRef.current = contentHeight;
    if (!hasSnappedToBottomRef.current) {
      ensureInitialSnap();
    }
    if (lockScrollToBottom.current) {
      // Force stay at bottom during initial image loading
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  }, [ensureInitialSnap]);

  // Release lock if user manually scrolls up
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    
    // If user scrolls up more than 50px from bottom, release the lock
    if (distanceFromBottom > 50 && lockScrollToBottom.current) {
      lockScrollToBottom.current = false;
    }
  }, []);

  useEffect(() => {
    if (!hasSnappedToBottomRef.current && messages.length > 0) {
      ensureInitialSnap();
    }
  }, [messages, ensureInitialSnap]);

  // Stable renderItem to prevent unnecessary MessageRow re-renders
  const renderMessageItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isLastInGroup = index === messages.length - 1 || messages[index + 1]?.senderId !== item.senderId;
    const isFirstInGroup = index === 0 || messages[index - 1]?.senderId !== item.senderId;
    return (
      <MessageRow 
        item={item} 
        index={index}
        isLastInGroup={isLastInGroup}
        isFirstInGroup={isFirstInGroup}
        shouldRenderImages={shouldRenderImages}
      />
    );
  }, [messages, shouldRenderImages]);

  const handleCopyMessage = useCallback(async () => {
    if (!selectedMessage) return;

    const textToCopy = selectedMessage.text;
    
    if (!textToCopy || textToCopy.trim().length === 0) {
      Alert.alert('No Text', 'This message has no text to copy');
      return;
    }

    try {
      await Clipboard.setStringAsync(textToCopy);
      // Silent copy - no notification
    } catch (error) {
      console.error('Failed to copy:', error);
      Alert.alert('Error', 'Failed to copy text');
    }
  }, [selectedMessage]);

  const handleDeleteMessage = useCallback(async () => {
    if (!selectedMessage || !user) return;

    Alert.alert(
      'Delete Message',
      'Remove this message from your device? Other participants will still see it.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessage(conversationId, selectedMessage.id, user.uid);
            } catch (error) {
              console.error('Failed to delete message:', error);
              Alert.alert('Error', 'Failed to delete message');
            }
          }
        }
      ]
    );
  }, [selectedMessage, user, conversationId]);

  // Manual retry handler for queued messages
  const handleRetryMessage = useCallback(async (localId: string) => {
    try {
      const { getQueue } = await import('../../services/offlineQueue');
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
        message.mediaURL,
        10000
      );
      
      // Update conversation preview (batched)
      const previewText = message.type === 'image' ? '📷 Image' : message.text;
      updateConversationLastMessageBatched(message.conversationId, previewText, message.senderId, localId);
      
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

  // Retry handler that returns success/failure (for failed messages)
  const handleRetryMessageWithAlert = useCallback(async (localId: string): Promise<boolean> => {
    try {
      const { retryMessage } = await import('../../services/offlineQueue');
      
      // Show loading
      setMessages(prev =>
        prev.map(msg =>
          msg.localId === localId || msg.id === localId
            ? { ...msg, status: 'sending' }
            : msg
        )
      );
      
      // Try to retry
      const success = await retryMessage(localId);
      
      if (success) {
        // Update UI to sent
        setMessages(prev =>
          prev.map(msg =>
            msg.localId === localId || msg.id === localId
              ? { ...msg, status: 'sent' }
              : msg
          )
        );
        Alert.alert('✅ Sent', 'Message sent successfully');
        return true;
      } else {
        // Update UI back to failed
        setMessages(prev =>
          prev.map(msg =>
            msg.localId === localId || msg.id === localId
              ? { ...msg, status: 'failed' }
              : msg
          )
        );
        return false;
      }
    } catch (error) {
      console.error('Retry failed:', error);
      
      // Update UI back to failed
      setMessages(prev =>
        prev.map(msg =>
          msg.localId === localId || msg.id === localId
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
      return false;
    }
  }, []);

  // Memoized MessageRow component for FlatList performance
  const MessageRow = memo(({ 
    item: message, 
    index, 
    isLastInGroup, 
    isFirstInGroup,
    shouldRenderImages
  }: { 
    item: Message; 
    index: number;
    isLastInGroup: boolean;
    isFirstInGroup: boolean;
    shouldRenderImages: boolean;
  }) => {
    const isOwnMessage = message.senderId === user!.uid;
    const hasImageContent = message.type === 'image' && message.mediaURL;
    const isImageMessage = hasImageContent && shouldRenderImages;
    const isImagePlaceholder = hasImageContent && !shouldRenderImages;
    const readReceipt = isOwnMessage ? formatReadReceipt(message) : null;
    const formattedTime = format(message.timestamp, 'h:mm a');
    
    // Get sender info for group chats
    const senderInfo = !isOwnMessage && isGroupChat ? getSenderInfo(message.senderId) : null;
    
    // Stable callbacks to prevent CachedImage re-render
    const handleImagePress = useCallback(() => {
      setViewerImageUrl(message.mediaURL!);
    }, [message.mediaURL]);
    
    const handleImageLongPress = useCallback(() => {
      handleLongPressMessage(message);
    }, [message]);
    
    // Optimistic UI opacity animation
    const messageOpacity = useSharedValue(
      message.status === 'sending' ? 0.7 : 
      message.status === 'queued' ? 0.6 : 
      1
    );
    
    useEffect(() => {
      if (message.status === 'sent' || message.status === 'delivered') {
        messageOpacity.value = withTiming(1, { duration: 300 });
      }
    }, [message.status]);
    
    const messageAnimatedStyle = useAnimatedStyle(() => ({
      opacity: messageOpacity.value
    }));
    
    return (
      <Animated.View 
        style={[styles.messageRow, messageAnimatedStyle]}
      >
        {isOwnMessage ? (
          // Blue bubbles: All move together with container gesture
          <GestureDetector gesture={containerPanGesture}>
            <Animated.View style={[styles.ownMessageWrapper, blueBubblesAnimatedStyle]}>
              <View style={styles.messageContainer}>
                {isImageMessage ? (
                  <View style={[styles.imageMessageContainer, styles.ownImageContainer]}>
                    <CachedImage
                      uri={message.mediaURL!}
                      style={[styles.messageImage, styles.ownMessageImage]}
                      resizeMode="cover"
                      onPress={handleImagePress}
                      onLongPress={handleImageLongPress}
                      delayLongPress={500}
                    />
                  </View>
                ) : isImagePlaceholder ? (
                  <View style={[styles.imageMessageContainer, styles.ownImageContainer]}>
                    <View style={[styles.messageImage, styles.ownMessageImage, styles.imagePlaceholder]} />
                  </View>
                ) : (
                  <Pressable 
                    onLongPress={() => handleLongPressMessage(message)}
                    delayLongPress={500}
                    style={[
                      styles.messageBubble,
                      styles.ownMessage,
                    ]}
                  >
                    <Text style={[styles.messageText, { color: '#fff' }]}>
                      {message.text}
                    </Text>
                  </Pressable>
                )}
                
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
                
                {/* Failed status - red exclamation icon with haptic feedback */}
                {message.status === 'failed' && (
                  <TouchableOpacity 
                    onPress={async () => {
                      // Haptic feedback on tap
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      
                      if (user) {
                        // Try retry first
                        const success = await handleRetryMessageWithAlert(message.localId || message.id);
                        
                        if (!success) {
                          // Show alert with options after 3 failed attempts
                          Alert.alert(
                            'Message Failed',
                            'This message failed to send after multiple attempts.',
                            [
                              {
                                text: 'Try Again',
                                onPress: () => handleRetryMessage(message.localId || message.id)
                              },
                              {
                                text: 'Delete Message',
                                style: 'destructive',
                                onPress: async () => {
                                  // Remove from queue and messages
                                  await removeFromQueue(message.localId || message.id);
                                  setMessages(prev => prev.filter(m => m.localId !== message.localId && m.id !== message.id));
                                }
                              },
                              {
                                text: 'Cancel',
                                style: 'cancel'
                              }
                            ]
                          );
                        }
                      }
                    }}
                    style={styles.failedIcon}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="alert-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
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
              
              {isImageMessage ? (
                <View style={[styles.imageMessageContainer, styles.otherImageContainer]}>
                  <CachedImage
                    uri={message.mediaURL!}
                    style={[styles.messageImage, styles.otherMessageImage]}
                    resizeMode="cover"
                    onPress={handleImagePress}
                    onLongPress={handleImageLongPress}
                    delayLongPress={500}
                  />
                </View>
              ) : isImagePlaceholder ? (
                <View style={[styles.imageMessageContainer, styles.otherImageContainer]}>
                  <View style={[styles.messageImage, styles.otherMessageImage, styles.imagePlaceholder]} />
                </View>
              ) : (
                <Pressable 
                  onLongPress={() => handleLongPressMessage(message)}
                  delayLongPress={500}
                  style={[
                    styles.messageBubble,
                    styles.otherMessage,
                  ]}
                >
                  <Text style={[styles.messageText, { color: '#000' }]}>
                    {message.text}
                  </Text>
                </Pressable>
              )}
              
              {/* Read receipt below bubble */}
              {readReceipt && isLastInGroup && (
                <Text style={styles.readReceipt}>
                  {readReceipt}
                </Text>
              )}
            </View>
          </View>
        )}
      </Animated.View>
    );
  }, (prevProps, nextProps) => {
    // Only re-render if message content/status or grouping actually changed
    const prev = prevProps.item;
    const next = nextProps.item;
    
    return (
      prev.id === next.id &&
      prev.text === next.text &&
      prev.status === next.status &&
      prev.readBy.length === next.readBy.length &&
      prev.deliveredTo.length === next.deliveredTo.length &&
      prev.mediaURL === next.mediaURL &&
      prevProps.index === nextProps.index &&
      prevProps.isLastInGroup === nextProps.isLastInGroup &&
      prevProps.isFirstInGroup === nextProps.isFirstInGroup &&
      prevProps.shouldRenderImages === nextProps.shouldRenderImages
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
          renderItem={renderMessageItem}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={true}
          removeClippedSubviews={true}
          maxToRenderPerBatch={20}
          windowSize={21}
          initialNumToRender={20}
          onLayout={handleFlatListLayout}
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            const fallbackOffset = Math.max(0, (averageItemLength || 80) * index);
            requestAnimationFrame(() => {
              flatListRef.current?.scrollToOffset({
                offset: fallbackOffset,
                animated: true,
              });
            });
          }}
          ListFooterComponent={() => (
            <>
              {/* Typing Indicator - styled like regular messages with avatar */}
              {typingUsers.length > 0 && (
                <View style={styles.messageRow}>
                  <View style={styles.otherMessageWrapper}>
                    {/* Avatar - show first typing user's initials */}
                    {(() => {
                      const firstTyper = typingUsers[0];
                      const typerDetails = participantDetailsMap[firstTyper.userId];
                      const initials = typerDetails?.initials || firstTyper.displayName?.substring(0, 2).toUpperCase() || '??';
                      
                      return (
                        <View style={styles.senderAvatar}>
                          <Text style={styles.senderAvatarText}>{initials}</Text>
                        </View>
                      );
                    })()}
                    
                    <View style={styles.messageContainer}>
                      {/* Sender name(s) above bubble */}
                      {isGroupChat && (
                        <Text style={styles.senderName}>{typingText.replace(' is typing...', '').replace(' are typing...', '')}</Text>
                      )}
                      
                      {/* Typing dots in grey bubble */}
                      <View style={styles.typingBubble}>
                        <View style={styles.typingDotsContainer}>
                          <View style={[styles.typingDot, styles.typingDot1]} />
                          <View style={[styles.typingDot, styles.typingDot2]} />
                          <View style={[styles.typingDot, styles.typingDot3]} />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </>
          )}
        />
      </View>

      {/* Queue Visibility Banner - shows pending/failed messages */}
      <QueueVisibilityBanner 
        conversationId={conversationId}
        onTapBanner={() => {
          // Scroll to first queued/failed message
          const firstQueuedIndex = messages.findIndex(m => m.status === 'queued' || m.status === 'failed');
          if (firstQueuedIndex !== -1) {
            try {
              flatListRef.current?.scrollToIndex({ 
                index: firstQueuedIndex, 
                animated: true,
                viewPosition: 0.5 // Center the message
              });
            } catch {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }
        }}
      />

      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={[styles.imageButton, isUploadingImage && styles.imageButtonDisabled]}
          onPress={handlePickImage}
          disabled={isUploadingImage}
        >
          {isUploadingImage ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Ionicons name="image-outline" size={26} color="#007AFF" />
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
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

      {/* Image Viewer Modal */}
      {viewerImageUrl && (
        <ImageViewer
          visible={true}
          imageUrl={viewerImageUrl}
          onClose={() => setViewerImageUrl(null)}
        />
      )}

      {/* Message Action Sheet */}
      <MessageActionSheet
        visible={actionSheetVisible}
        onClose={() => {
          setActionSheetVisible(false);
          setSelectedMessage(null);
        }}
        onCopy={handleCopyMessage}
        onDelete={handleDeleteMessage}
        messageText={selectedMessage?.text || ''}
        isOwnMessage={selectedMessage?.senderId === user?.uid}
        deleteLabel={selectedMessage?.senderId === user?.uid ? 'Delete' : 'Delete for me'}
      />

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
  imageMessageContainer: {
    maxWidth: '80%',
    marginBottom: 2,
  },
  ownImageContainer: {
    alignSelf: 'flex-end',
    marginLeft: 'auto', // Push to far right
    marginRight: 8, // Small margin so images don't touch screen edge
  },
  otherImageContainer: {
    alignSelf: 'flex-start',
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
  },
  ownMessageImage: {
    borderWidth: 0,
    // No border for own images - clean look
  },
  otherMessageImage: {
    borderWidth: 0,
    // No border for received images - clean look
  },
  imagePlaceholder: {
    backgroundColor: '#E8E8E8',
    // Placeholder reserves space for image before it loads
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
  imageButtonDisabled: {
    opacity: 0.6,
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
    marginRight: 12,
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
  failedIcon: {
    marginTop: 4,
    alignSelf: 'flex-end',
    padding: 4,
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
