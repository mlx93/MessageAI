import { useState, useEffect } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useAuth } from '../store/AuthContext';
import { searchUserByPhone, getUserContacts } from '../services/contactService';
import { formatPhoneNumber } from '../utils/phoneFormat';
import { createOrGetConversation, updateConversationLastMessage } from '../services/conversationService';
import { sendMessage } from '../services/messageService';
import { v4 as uuidv4 } from 'uuid';

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

  useEffect(() => {
    navigation.setOptions({
      title: 'New Message',
      headerBackTitleVisible: false,
      headerBackTitle: '', // Remove back button text
      headerShown: true,
    });
  }, []);

  useEffect(() => {
    if (!searchText.trim() || !user) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const searchTimeout = setTimeout(async () => {
      try {
        // Search by phone number
        const phoneUser = await searchUserByPhone(searchText);
        const results: Contact[] = [];
        
        if (phoneUser && !selectedUsers.find(u => u.uid === phoneUser.uid)) {
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
            c.name.toLowerCase().includes(searchText.toLowerCase()) &&
            !selectedUsers.find(u => u.uid === c.appUserId)
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
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchText, selectedUsers, user]);

  const handleSelectUser = (contact: Contact) => {
    setSelectedUsers([...selectedUsers, contact]);
    setSearchText('');
    setSearchResults([]);
  };

  const handleRemoveUser = (uid: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.uid !== uid));
  };

  const handleSend = async () => {
    if (!messageText.trim() || selectedUsers.length === 0 || !user) return;

    try {
      // Create conversation with selected users
      const participantIds = [user.uid, ...selectedUsers.map(u => u.uid)];
      const conversationId = await createOrGetConversation(participantIds);
      
      // Send the first message
      const localId = uuidv4();
      await sendMessage(conversationId, messageText.trim(), user.uid, localId);
      await updateConversationLastMessage(conversationId, messageText.trim(), user.uid);
      
      // Navigate to the chat
      router.replace(`/chat/${conversationId}`);
    } catch (error: any) {
      console.error('Failed to create conversation:', error);
      alert('Failed to create conversation: ' + error.message);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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
            {selectedUsers.map(user => (
              <TouchableOpacity
                key={user.uid}
                style={styles.userPill}
                onPress={() => handleRemoveUser(user.uid)}
              >
                <Text style={styles.userPillText}>{user.displayName}</Text>
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
                  ? selectedUsers[0].displayName
                  : `${selectedUsers.length} people selected`
                }
              </Text>
            </View>
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
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 17,
    color: '#000',
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

