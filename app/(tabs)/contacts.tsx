import { View, FlatList, Text, TouchableOpacity, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getUserContacts, importContacts, searchUserByPhone } from '../../services/contactService';
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
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    if (!user) return;
    
    try {
      setImporting(true);
      // Try to import contacts if first time
      await importContacts(user.uid);
    } catch (error: any) {
      console.log('Import contacts error:', error);
      if (error.message !== 'Contacts permission denied') {
        Alert.alert('Error', 'Failed to import contacts: ' + error.message);
      }
    } finally {
      setImporting(false);
    }
    
    try {
      const userContacts = await getUserContacts(user.uid);
      setContacts(userContacts.filter(c => c.isAppUser) as Contact[]);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load contacts: ' + error.message);
    }
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
      <Text style={styles.title}>Contacts on App</Text>
      
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
      
      {/* Refresh contacts button */}
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={loadContacts}
        disabled={importing}
      >
        <Text style={styles.refreshText}>
          {importing ? 'Importing Contacts...' : '🔄 Import Contacts'}
        </Text>
      </TouchableOpacity>
      
      {importing && (
        <Text style={styles.importingSubtext}>
          Scanning your contacts for app users...
        </Text>
      )}
      
      {/* Contacts list */}
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => item.appUserId && startConversation(item.appUserId)}
            style={styles.contactItem}
          >
            <View style={styles.contactAvatar}>
              <Text style={styles.contactInitials}>
                {item.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
            </View>
            <View style={styles.chatButton}>
              <Text style={styles.chatButtonText}>Chat</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No contacts found on the app</Text>
            <Text style={styles.emptySubtext}>Invite friends to join or search by phone number above</Text>
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
  importingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
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
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
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

