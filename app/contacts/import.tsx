/**
 * Contact Import Screen
 * 
 * Allows users to selectively import contacts from their device
 * Shows all device contacts with checkboxes for selection
 */

import { useState, useEffect } from 'react';
import { 
  View, 
  FlatList, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../store/AuthContext';
import * as Contacts from 'expo-contacts';
import { normalizePhoneNumber } from '../../services/contactService';
import { collection, query, where, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface DeviceContact {
  id: string;
  name: string;
  phoneNumber: string;
  selected: boolean;
}

export default function ImportContactsScreen() {
  const { user } = useAuth();
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<DeviceContact[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    loadDeviceContacts();
  }, []);

  useEffect(() => {
    if (searchText.trim()) {
      const filtered = deviceContacts.filter(contact =>
        contact.name.toLowerCase().includes(searchText.toLowerCase()) ||
        contact.phoneNumber.includes(searchText)
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(deviceContacts);
    }
  }, [searchText, deviceContacts]);

  const loadDeviceContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant contacts permission to import contacts',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      const contactsList: DeviceContact[] = [];
      data.forEach(contact => {
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          contact.phoneNumbers.forEach(phone => {
            if (phone.number) {
              contactsList.push({
                id: `${contact.id}-${phone.number}`,
                name: contact.name || 'Unknown',
                phoneNumber: normalizePhoneNumber(phone.number),
                selected: false,
              });
            }
          });
        }
      });

      // Remove duplicates by phone number
      const uniqueContacts = Array.from(
        new Map(contactsList.map(c => [c.phoneNumber, c])).values()
      );

      setDeviceContacts(uniqueContacts);
      setFilteredContacts(uniqueContacts);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load contacts: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleContact = (contactId: string) => {
    setDeviceContacts(prev =>
      prev.map(c => c.id === contactId ? { ...c, selected: !c.selected } : c)
    );
  };

  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setDeviceContacts(prev => prev.map(c => ({ ...c, selected: newSelectAll })));
  };

  const importSelectedContacts = async () => {
    if (!user) return;

    const selectedContacts = deviceContacts.filter(c => c.selected);
    
    if (selectedContacts.length === 0) {
      Alert.alert('No Selection', 'Please select at least one contact to import');
      return;
    }

    setImporting(true);
    try {
      // Batch match against app users
      const phoneNumbers = selectedContacts.map(c => c.phoneNumber);
      const matches: any[] = [];
      
      // Firestore 'in' query limit is 10, batch the queries
      for (let i = 0; i < phoneNumbers.length; i += 10) {
        const batch = phoneNumbers.slice(i, i + 10);
        const q = query(collection(db, 'users'), where('phoneNumber', 'in', batch));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(doc => matches.push({ uid: doc.id, ...doc.data() }));
      }

      // Store selected contacts in Firestore
      const firestoreBatch = writeBatch(db);
      
      for (const contact of selectedContacts) {
        const matchedUser = matches.find(u => u.phoneNumber === contact.phoneNumber);
        const contactRef = doc(db, `users/${user.uid}/contacts`, contact.phoneNumber);
        
        firestoreBatch.set(contactRef, {
          phoneNumber: contact.phoneNumber,
          name: contact.name,
          isAppUser: !!matchedUser,
          appUserId: matchedUser?.uid || null,
          lastSynced: new Date()
        });
      }

      await firestoreBatch.commit();

      Alert.alert(
        'Success',
        `${selectedContacts.length} contact${selectedContacts.length === 1 ? '' : 's'} imported successfully!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Import Failed', error.message);
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = deviceContacts.filter(c => c.selected).length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your contacts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Select All Toggle */}
      <View style={styles.selectAllContainer}>
        <TouchableOpacity 
          style={styles.selectAllButton}
          onPress={toggleSelectAll}
          disabled={importing}
        >
          <View style={styles.checkbox}>
            {selectAll && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.selectAllText}>Select All ({deviceContacts.length} contacts)</Text>
        </TouchableOpacity>
      </View>

      {/* Contacts List */}
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => toggleContact(item.id)}
            disabled={importing}
          >
            <View style={styles.checkbox}>
              {item.selected && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {searchText ? 'No contacts match your search' : 'No contacts found on device'}
            </Text>
          </View>
        }
      />

      {/* Import Button */}
      <View style={styles.bottomBar}>
        <Text style={styles.selectedCount}>
          {selectedCount} contact{selectedCount === 1 ? '' : 's'} selected
        </Text>
        <TouchableOpacity
          style={[styles.importButton, importing && styles.importButtonDisabled]}
          onPress={importSelectedContacts}
          disabled={importing || selectedCount === 0}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.importButtonText}>
              Import {selectedCount > 0 ? `(${selectedCount})` : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#F8F8F8',
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectAllContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#F8F8F8',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkmark: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#000',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    backgroundColor: '#F8F8F8',
  },
  selectedCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  importButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  importButtonDisabled: {
    backgroundColor: '#C0C0C0',
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

