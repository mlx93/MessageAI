import { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, FlatList, Alert, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { useAuth } from '../../store/AuthContext';
import { formatPhoneNumber } from '../../utils/phoneFormat';
import { subscribeToMessages, sendMessage, sendImageMessage, markMessagesAsRead, markMessageAsDelivered } from '../../services/messageService';
import { updateConversationLastMessage, addParticipantToConversation } from '../../services/conversationService';
import { cacheMessage, getCachedMessages } from '../../services/sqliteService';
import { queueMessage } from '../../services/offlineQueue';
import { searchUserByPhone, getUserContacts } from '../../services/contactService';
import { subscribeToUserPresence } from '../../services/presenceService';
import { pickAndUploadImage } from '../../services/imageService';
import { setActiveConversation } from '../../services/notificationService';
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
  const [isAddMode, setIsAddMode] = useState(false);
  const [addSearchText, setAddSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentParticipants, setCurrentParticipants] = useState<Participant[]>([]);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<Date | undefined>();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const conversationId = id as string;
  const hasMarkedRead = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
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

  // Load conversation details and participants
  useEffect(() => {
    if (!user) return;

    const loadConversationTitle = async () => {
      try {
        const { getConversation } = await import('../../services/conversationService');
        const conversation = await getConversation(conversationId);
        if (conversation) {
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
            // Add presence status
            if (otherUserOnline) {
              subtitle = 'Online';
            } else if (otherUserLastSeen) {
              const minutesAgo = Math.floor((new Date().getTime() - otherUserLastSeen.getTime()) / 60000);
              if (minutesAgo < 1) {
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

          navigation.setOptions({
            title: isAddMode ? '' : title,
            headerBackTitle: 'Messages',
            headerRight: () => (
              <TouchableOpacity 
                onPress={isAddMode ? handleCancelAdd : handleAddParticipant} 
                style={{ marginRight: 8 }}
              >
                <Text style={{ color: '#007AFF', fontSize: 17 }}>
                  {isAddMode ? 'Cancel' : 'Add'}
                </Text>
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
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 100);
      }
    }).catch(error => {
      console.error('Failed to load cached messages:', error);
    });

    // Network status
    const unsubscribeNet = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected || false);
    });

    // Subscribe to real-time messages
    const unsubscribeMessages = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      
      // Cache messages
      msgs.forEach(m => {
        cacheMessage(m).catch(error => {
          console.error('Failed to cache message:', error);
        });
      });
      
      // Mark messages as delivered
      msgs.filter(m => m.senderId !== user!.uid && !m.deliveredTo.includes(user!.uid))
        .forEach(m => markMessageAsDelivered(conversationId, m.id, user!.uid));
      
      // Mark as read
      if (!hasMarkedRead.current) {
        const unreadIds = msgs.filter(m => m.senderId !== user!.uid && !m.readBy.includes(user!.uid)).map(m => m.id);
        if (unreadIds.length > 0) {
          markMessagesAsRead(conversationId, user!.uid, unreadIds);
          hasMarkedRead.current = true;
        }
      }
    });

    return () => {
      unsubscribeNet();
      unsubscribeMessages();
    };
  }, [conversationId, user, isAddMode, navigation, otherUserOnline, otherUserLastSeen]);

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
            const unsubscribe = subscribeToUserPresence(otherUserId, (online, lastSeen) => {
              setOtherUserOnline(online);
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

  // Set active conversation for smart notifications
  useEffect(() => {
    if (!user) return;

    // Set this conversation as active
    setActiveConversation(user.uid, conversationId).catch(error => {
      console.error('Failed to set active conversation:', error);
    });

    // Clear on unmount
    return () => {
      setActiveConversation(user.uid, null).catch(error => {
        console.error('Failed to clear active conversation:', error);
      });
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
        // Search by phone number
        const phoneUser = await searchUserByPhone(addSearchText);
        const results: SearchResult[] = [];
        
        if (phoneUser && !currentParticipants.find(p => p.uid === phoneUser.uid) && phoneUser.uid !== user.uid) {
          results.push({
            uid: phoneUser.uid,
            displayName: phoneUser.displayName,
            phoneNumber: phoneUser.phoneNumber,
            initials: phoneUser.initials,
          });
        }

        // Also get contacts and filter by name
        const contacts = await getUserContacts(user.uid);
        const nameMatches = contacts
          .filter(c => 
            c.isAppUser && 
            c.name.toLowerCase().includes(addSearchText.toLowerCase()) &&
            !currentParticipants.find(p => p.uid === c.appUserId) &&
            c.appUserId !== user.uid
          )
          .map(c => ({
            uid: c.appUserId!,
            displayName: c.name,
            phoneNumber: c.phoneNumber,
            initials: c.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          }));

        // Combine and deduplicate
        const allResults = [...results, ...nameMatches];
        const unique = Array.from(
          new Map(allResults.map(item => [item.uid, item])).values()
        );
        
        setSearchResults(unique.slice(0, 5));
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

    // Optimistic UI
    setMessages(prev => [...prev, tempMessage]);
    setInputText('');
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      if (isOnline) {
        await sendMessage(conversationId, tempMessage.text, user.uid, localId);
        await updateConversationLastMessage(conversationId, tempMessage.text, user.uid);
      } else {
        await queueMessage({
          conversationId,
          text: tempMessage.text,
          senderId: user.uid,
          localId
        });
        console.log('📤 Message queued for offline sending');
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== localId));
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

  // Container-level pan gesture for all blue bubbles
  const containerPanGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow left swipe (negative translation)
      if (event.translationX < 0) {
        blueBubblesTranslateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      if (event.translationX < -60) {
        // Reveal all timestamps
        blueBubblesTranslateX.value = withSpring(-100);
      } else {
        // Hide timestamps
        blueBubblesTranslateX.value = withSpring(0);
      }
    });

  // Animated style for all blue bubbles
  const blueBubblesAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: blueBubblesTranslateX.value }],
  }));

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
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

      // Send to server
      if (isOnline) {
        await sendImageMessage(conversationId, imageUrl, user.uid, localId);
        await updateConversationLastMessage(conversationId, '📷 Image', user.uid);
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
  };

  const handleCancelAdd = () => {
    setIsAddMode(false);
    setAddSearchText('');
    setSearchResults([]);
  };

  const handleSelectUser = async (selectedUser: SearchResult) => {
    try {
      await addParticipantToConversation(conversationId, selectedUser.uid);
      
      // Add to current participants list
      setCurrentParticipants(prev => [...prev, {
        uid: selectedUser.uid,
        displayName: selectedUser.displayName
      }]);
      
      // Reset add mode
      setAddSearchText('');
      setSearchResults([]);
      
      Alert.alert('Success', `${selectedUser.displayName} added to conversation!`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

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
              {currentParticipants.map(participant => (
                <View key={participant.uid} style={styles.participantPill}>
                  <Text style={styles.participantPillText}>{participant.displayName}</Text>
                </View>
              ))}
              <TextInput
                style={styles.addSearchInput}
                value={addSearchText}
                onChangeText={setAddSearchText}
                placeholder="Type name or number..."
                placeholderTextColor="#999"
                autoFocus={Platform.OS === 'ios'}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
                returnKeyType="search"
                editable={true}
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
          <Text style={styles.offlineText}>Offline - Messages will send when connected</Text>
        </View>
      )}

      <View style={styles.messagesWrapper}>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map((message, index) => {
            const isOwnMessage = message.senderId === user.uid;
            const isImageMessage = message.type === 'image' && message.mediaURL;
            const readReceipt = isOwnMessage ? formatReadReceipt(message) : null;
            const isLastInGroup = index === messages.length - 1 || messages[index + 1]?.senderId !== message.senderId;
            const formattedTime = format(message.timestamp, 'h:mm a');
            
            return (
              <View key={`${message.id}-${index}`} style={styles.messageRow}>
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
                      </View>
                      
                      {/* Timestamp revealed on swipe */}
                      <View style={styles.timestampRevealContainer}>
                        <Text style={styles.timestampRevealText}>{formattedTime}</Text>
                      </View>
                    </Animated.View>
                  </GestureDetector>
                ) : (
                  // Grey bubbles: Fixed, no swipe
                  <View style={styles.messageContainer}>
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
                )}
              </View>
            );
          })}

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
        </ScrollView>
      </View>

      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={styles.imageButton}
          onPress={handlePickImage}
          disabled={isUploadingImage}
        >
          {isUploadingImage ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Ionicons name="image-outline" size={28} color="#007AFF" />
          )}
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
  },
  participantPillText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '500',
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
    padding: 16,
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
    right: -100, // Hidden beyond viewport initially
    top: 0,
    bottom: 0,
    width: 90,
    justifyContent: 'center',
    paddingLeft: 12,
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
  },
  otherMessage: {
    backgroundColor: '#E8E8E8',
    alignSelf: 'flex-start',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
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
    alignSelf: 'flex-end', // Align with blue bubbles
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
    padding: 8,
    marginRight: 4,
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
});
