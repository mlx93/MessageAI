import { useState, useEffect } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useAuth } from '../store/AuthContext';
import { searchAllUsers, getUserContacts } from '../services/contactService';
import { formatPhoneNumber } from '../utils/phoneFormat';
import { createOrGetConversation, updateConversationLastMessage } from '../services/conversationService';
import { sendMessage } from '../services/messageService';
import { v4 as uuidv4 } from 'uuid';
import { Ionicons } from '@expo/vector-icons';

interface Contact {
  uid: string;
  displayName: string;
  phoneNumber: string;
  initials: string;
}

export default function NewMessageScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Contact[]>([]);
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Header is now configured in _layout.tsx

  useEffect(() => {
    if (!searchText.trim() || !user) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const searchTimeout = setTimeout(async () => {
      try {
        // Search ALL app users (not just contacts) with fuzzy matching
        const users = await searchAllUsers(searchText, user.uid, 10);
        
        // Filter out already selected users and format results
        const results = users
          .filter(u => !selectedUsers.find(selected => selected.uid === u.uid))
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
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchText, selectedUsers, user]);

  const handleSelectUser = (contact: Contact) => {
    const newSelectedUsers = [...selectedUsers, contact];
    setSelectedUsers(newSelectedUsers);
    setSearchText('');
    setSearchResults([]);
    
    // Don't auto-navigate - let user add more people if they want
    // They'll use the "Continue to Chat" button when ready
  };

  const handleRemoveUser = (uid: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.uid !== uid));
  };

  const handleContinueToChat = async () => {
    if (selectedUsers.length === 0 || !user) return;

    try {
      // Find or create conversation with selected users
      const participantIds = [user.uid, ...selectedUsers.map(u => u.uid)];
      const conversationId = await createOrGetConversation(participantIds, user.uid);
      
      // Navigate to the existing/new conversation
      router.replace(`/chat/${conversationId}`);
    } catch (error: any) {
      console.error('Failed to find conversation:', error);
      alert('Failed to open conversation: ' + error.message);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() || selectedUsers.length === 0 || !user) return;

    try {
      // Create conversation with selected users
      const participantIds = [user.uid, ...selectedUsers.map(u => u.uid)];
      const conversationId = await createOrGetConversation(participantIds, user.uid);
      
      // Send the first message
      const localId = uuidv4();
      await sendMessage(conversationId, messageText.trim(), user.uid, localId);
      await updateConversationLastMessage(conversationId, messageText.trim(), user.uid, localId);
      
      // Navigate to the chat
      router.replace(`/chat/${conversationId}`);
    } catch (error: any) {
      console.error('Failed to create conversation:', error);
      alert('Failed to create conversation: ' + error.message);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
      >
        {/* To: field with selected users */}
        <View style={styles.toContainer}>
        <Text style={styles.toLabel}>To:</Text>
        <View style={styles.toContent}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.selectedUsersScroll}
          >
            {selectedUsers.map(selectedUser => (
              <TouchableOpacity
                key={selectedUser.uid}
                style={styles.userPill}
                onPress={() => handleRemoveUser(selectedUser.uid)}
              >
                <Text style={styles.userPillText}>{selectedUser.displayName}</Text>
                <Text style={styles.userPillRemove}>✕</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder={selectedUsers.length === 0 ? 'Enter name or number' : ''}
              placeholderTextColor="#999"
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </ScrollView>
        </View>
      </View>

      {/* Search results dropdown */}
      {searchResults.length > 0 && (
        <View style={styles.searchResultsContainer}>
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

      {/* Message compose area - only show if users selected */}
      {selectedUsers.length > 0 && (
        <>
          <View style={styles.separator} />
          <View style={styles.composeContainer}>
            <View style={styles.selectedUsersSummary}>
              <Text style={styles.summaryText}>
                {selectedUsers.length === 1 
                  ? `Chat with ${selectedUsers[0].displayName}`
                  : `${selectedUsers.length} people selected`
                }
              </Text>
            </View>
            
            {/* Continue to Chat button - shown for any number of selected users */}
            <TouchableOpacity 
              style={styles.continueButton}
              onPress={handleContinueToChat}
            >
              <Ionicons name="checkmark-circle" size={24} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.continueButtonText}>
                {selectedUsers.length === 1 ? 'Open Chat' : 'Continue to Group'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Message input at bottom */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="iMessage"
          placeholderTextColor="#999"
          multiline
          maxLength={1000}
          editable={selectedUsers.length > 0}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!messageText.trim() || selectedUsers.length === 0) && styles.sendButtonDisabled
          ]}
          onPress={handleSend}
          disabled={!messageText.trim() || selectedUsers.length === 0}
        >
          <Text style={styles.sendButtonText}>↑</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  toContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    minHeight: 60,
  },
  toLabel: {
    fontSize: 17,
    color: '#000',
    marginRight: 8,
  },
  toContent: {
    flex: 1,
  },
  selectedUsersScroll: {
    flexGrow: 0,
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    marginRight: 8,
  },
  userPillText: {
    color: '#fff',
    fontSize: 15,
    marginRight: 6,
  },
  userPillRemove: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchInput: {
    fontSize: 17,
    color: '#000',
    minWidth: 100,
    paddingVertical: 4,
  },
  searchResultsContainer: {
    maxHeight: 300,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
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
  separator: {
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  composeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedUsersSummary: {
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 12,
  },
  continueButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#fff',
    marginTop: 'auto',
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    minHeight: 36,
    fontSize: 17,
    color: '#000',
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#C0C0C0',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

