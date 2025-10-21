import { useState, useEffect, useCallback, useRef } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, FlatList, Alert } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { useAuth } from '../../store/AuthContext';
import { subscribeToMessages, sendMessage, markMessagesAsRead, markMessageAsDelivered } from '../../services/messageService';
import { updateConversationLastMessage, addParticipantToConversation } from '../../services/conversationService';
import { cacheMessage, getCachedMessages } from '../../services/sqliteService';
import { queueMessage } from '../../services/offlineQueue';
import { searchUserByPhone, getUserContacts } from '../../services/contactService';
import { v4 as uuidv4 } from 'uuid';
import NetInfo from '@react-native-community/netinfo';
import { Message } from '../../types';

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
  const conversationId = id as string;
  const hasMarkedRead = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);

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
          if (conversation.type === 'direct') {
            const otherUserId = conversation.participants.find(id => id !== user.uid);
            title = conversation.participantDetails[otherUserId!]?.displayName || 'Chat';
          } else {
            const names = conversation.participants
              .filter(id => id !== user.uid)
              .map(id => conversation.participantDetails[id]?.displayName.split(' ')[0])
              .slice(0, 3)
              .join(', ');
            title = names + (conversation.participants.length > 4 ? '...' : '');
          }

          navigation.setOptions({
            title: isAddMode ? '' : title,
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
        navigation.setOptions({ title: 'Chat' });
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
  }, [conversationId, user, isAddMode, navigation]);

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
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
                      <Text style={styles.resultPhone}>{item.phoneNumber}</Text>
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

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message, index) => {
          const isOwnMessage = message.senderId === user.uid;
          return (
            <View 
              key={`${message.id}-${index}`} 
              style={[
                styles.messageBubble,
                isOwnMessage ? styles.ownMessage : styles.otherMessage
              ]}
            >
              {!isOwnMessage && (
                <Text style={styles.senderName}>
                  {message.senderId === user.uid ? 'You' : 'User'}
                </Text>
              )}
              <Text style={[styles.messageText, { color: isOwnMessage ? '#fff' : '#000' }]}>
                {message.text}
              </Text>
              <View style={styles.messageFooter}>
                <Text style={[styles.messageTime, { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#999' }]}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isOwnMessage && (
                  <Text style={styles.messageStatus}>
                    {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputContainer}>
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
  offlineBanner: {
    backgroundColor: '#ff9800',
    padding: 10,
  },
  offlineText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  ownMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#E8E8E8',
    alignSelf: 'flex-start',
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
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
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
