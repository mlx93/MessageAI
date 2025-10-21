import { View, FlatList, Text, TouchableOpacity, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getUserContacts, searchUserByPhone } from '../../services/contactService';
import { router } from 'expo-router';

interface Contact {
  id: string;
  phoneNumber: string;
  name: string;
  isAppUser: boolean;
  appUserId: string | null;
  lastSynced: Date;
}

export default function ContactsScreen() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchPhone, setSearchPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadContacts();
    }
  }, [user]);

  const loadContacts = async () => {
    if (!user) return;
    
    try {
      const userContacts = await getUserContacts(user.uid);
      console.log(`📇 Loaded ${userContacts.length} contacts from Firestore`);
      // Show ALL contacts (both app users and non-app users)
      setContacts(userContacts as Contact[]);
    } catch (error: any) {
      console.error('Failed to load contacts:', error);
      // Silently fail - user can manually import
    }
  };

  const handleImportContacts = () => {
    router.push('/contacts/import');
  };

  const startConversation = async (contactUserId: string) => {
    if (!user) return;
    
    try {
      // Import conversation service dynamically to avoid circular deps
      const { createOrGetConversation } = await import('../../services/conversationService');
      const conversationId = await createOrGetConversation([user.uid, contactUserId]);
      router.push(`/chat/${conversationId}`);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to create conversation: ' + error.message);
    }
  };

  const searchAndStartChat = async () => {
    if (!searchPhone || !user) return;
    
    setLoading(true);
    try {
      const foundUser = await searchUserByPhone(searchPhone);
      if (foundUser) {
        const { createOrGetConversation } = await import('../../services/conversationService');
        const conversationId = await createOrGetConversation([user.uid, foundUser.uid]);
        router.push(`/chat/${conversationId}`);
      } else {
        Alert.alert('Not Found', 'No user found with that phone number');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Contacts</Text>
      
      {/* Search by phone section */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.input}
          placeholder="Enter phone number (+1234567890)"
          value={searchPhone}
          onChangeText={setSearchPhone}
          keyboardType="phone-pad"
        />
        <Button 
          title={loading ? "Searching..." : "Start Chat"} 
          onPress={searchAndStartChat} 
          disabled={loading || !searchPhone}
        />
      </View>
      
      {/* Import contacts button */}
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={handleImportContacts}
      >
        <Text style={styles.refreshText}>
          📱 Import Contacts
        </Text>
      </TouchableOpacity>
      
      {contacts.length === 0 && (
        <Text style={styles.helpText}>
          Tap the button above to select contacts to import
        </Text>
      )}
      
      {/* Contacts list */}
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => item.isAppUser && item.appUserId && startConversation(item.appUserId)}
            style={[styles.contactItem, !item.isAppUser && styles.contactItemDisabled]}
            disabled={!item.isAppUser}
          >
            <View style={[styles.contactAvatar, !item.isAppUser && styles.contactAvatarDisabled]}>
              <Text style={styles.contactInitials}>
                {item.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactName, !item.isAppUser && styles.contactNameDisabled]}>
                {item.name}
              </Text>
              <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
              {!item.isAppUser && (
                <Text style={styles.notOnAppText}>Not on MessageAI</Text>
              )}
            </View>
            {item.isAppUser ? (
              <View style={styles.chatButton}>
                <Text style={styles.chatButtonText}>Chat</Text>
              </View>
            ) : (
              <View style={styles.inviteButton}>
                <Text style={styles.inviteButtonText}>Invite</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No contacts imported yet</Text>
            <Text style={styles.emptySubtext}>Tap "Import Contacts" above to get started</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  searchSection: {
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 16,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  refreshText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  helpText: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 15,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  contactItemDisabled: {
    opacity: 0.6,
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  contactAvatarDisabled: {
    backgroundColor: '#C0C0C0',
  },
  contactInitials: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000',
  },
  contactNameDisabled: {
    color: '#999',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
  },
  notOnAppText: {
    fontSize: 12,
    color: '#FF9500',
    marginTop: 2,
    fontStyle: 'italic',
  },
  chatButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  chatButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  inviteButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C0C0C0',
  },
  inviteButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

