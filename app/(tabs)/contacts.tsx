import { View, FlatList, Text, TouchableOpacity, TextInput, Button, Alert, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { getUserContacts, searchUserByPhone, normalizePhoneNumber } from '../../services/contactService';
import { formatPhoneNumber } from '../../utils/phoneFormat';
import { router } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { doc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

interface Contact {
  id: string;
  phoneNumber: string;
  name: string;
  isAppUser: boolean;
  appUserId: string | null;
  lastSynced: Date;
  isInContacts?: boolean; // NEW: Track if user is already in contacts
}

export default function ContactsScreen() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadContacts();
    }
  }, [user]);

  // Search across ALL app users, not just imported contacts
  useEffect(() => {
    if (!searchText.trim() || !user) {
      setFilteredContacts(contacts);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const searchTimeout = setTimeout(async () => {
      try {
        // Search all app users by name or phone
        const { searchAllUsers } = await import('../../services/contactService');
        const allUsers = await searchAllUsers(searchText, user.uid, 20);
        
        // Map to Contact format and check if already in contacts
        const searchResults = allUsers.map(u => {
          const existingContact = contacts.find(c => c.appUserId === u.uid || c.phoneNumber === u.phoneNumber);
          return {
            id: u.uid,
            phoneNumber: u.phoneNumber || '',
            name: u.displayName || `${u.firstName} ${u.lastName}`.trim(),
            isAppUser: true,
            appUserId: u.uid,
            lastSynced: existingContact?.lastSynced || new Date(),
            isInContacts: !!existingContact, // NEW: Track if already in contacts
          };
        });

        setFilteredContacts(searchResults);
      } catch (error) {
        console.error('Search error:', error);
        // Fallback to local filtering
        const searchLower = searchText.toLowerCase();
        const filtered = contacts.filter(contact => {
          const nameMatch = contact.name.toLowerCase().includes(searchLower);
          const phoneMatch = contact.phoneNumber.includes(searchText.replace(/\D/g, ''));
          return nameMatch || phoneMatch;
        });
        setFilteredContacts(filtered);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Debounce search

    return () => clearTimeout(searchTimeout);
  }, [searchText, contacts, user]);

  const loadContacts = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      setError(null);
      const userContacts = await getUserContacts(user.uid);
      console.log(`📇 Loaded ${userContacts.length} contacts from Firestore`);
      // Show ALL contacts (both app users and non-app users)
      setContacts(userContacts as Contact[]);
      setFilteredContacts(userContacts as Contact[]); // Initialize filtered contacts
      setLoading(false);
      setRefreshing(false);
    } catch (error: any) {
      console.error('Failed to load contacts:', error);
      setError(error.message || 'Failed to load contacts');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadContacts();
  };

  const handleImportAllContacts = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      // Use the bulk import function from contactService
      const { importContacts } = await import('../../services/contactService');
      await importContacts(user.uid);
      
      // Refresh contacts list
      const userContacts = await getUserContacts(user.uid);
      setContacts(userContacts as Contact[]);
      setFilteredContacts(userContacts as Contact[]);
      
      // Count how many contacts are app users
      const appUserCount = userContacts.filter((c: any) => c.isAppUser).length;
      const totalCount = userContacts.length;
      
      Alert.alert(
        'Import Complete',
        `${appUserCount} of ${totalCount} contacts are on aiMessage`
      );
    } catch (error: any) {
      console.error('Failed to import contacts:', error);
      Alert.alert('Error', error.message || 'Failed to import contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!user) return;
    
    try {
      // Request contacts permission
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant contacts permission to add contacts'
        );
        return;
      }

      // Open native contact picker (works on both iOS and Android)
      const result = await Contacts.presentContactPickerAsync();
      
      // Check if user cancelled
      if (!result || 'cancelled' in result) {
        console.log('User cancelled contact selection');
        return;
      }

      // Get contact data
      const contact = result;
      const phoneNumber = contact.phoneNumbers?.[0]?.number;
      
      if (!phoneNumber) {
        Alert.alert('No Phone Number', 'This contact has no phone number');
        return;
      }

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      
      // Extract name from various possible fields
      let contactName = 'Unknown';
      if (contact.name) {
        contactName = contact.name;
      } else if (contact.firstName || contact.lastName) {
        contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      } else if (contact.displayName) {
        contactName = contact.displayName;
      }
      
      // Fallback to phone number if still no name
      if (contactName === 'Unknown' || !contactName.trim()) {
        contactName = phoneNumber;
      }

      // Check if contact is an app user
      const q = query(collection(db, 'users'), where('phoneNumber', '==', normalizedPhone));
      const snapshot = await getDocs(q);
      const isAppUser = !snapshot.empty;
      const appUserId = isAppUser ? snapshot.docs[0].id : null;

      // Save to Firestore
      await setDoc(doc(db, `users/${user.uid}/contacts`, normalizedPhone), {
        phoneNumber: normalizedPhone,
        name: contactName,
        isAppUser,
        appUserId,
        lastSynced: new Date()
      });

      // Refresh contacts list
      await loadContacts();

      Alert.alert(
        'Contact Added',
        isAppUser 
          ? `${contactName} is on aiMessage! You can now chat with them.`
          : `${contactName} added to contacts. They're not on aiMessage yet.`
      );

    } catch (error: any) {
      console.error('Failed to add contact:', error);
      Alert.alert('Error', 'Failed to add contact. Please try again.');
    }
  };

  const [isNavigating, setIsNavigating] = useState(false);

  const handleDeleteContact = (contact: Contact) => {
    Alert.alert(
      'Delete Contact',
      `Remove ${contact.name} from your contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user) return;
              // Delete from Firestore
              await deleteDoc(doc(db, `users/${user.uid}/contacts`, contact.phoneNumber));
              // Refresh contacts list
              await loadContacts();
            } catch (error: any) {
              console.error('Failed to delete contact:', error);
              Alert.alert('Error', 'Failed to delete contact');
            }
          },
        },
      ]
    );
  };

  const handleAddSearchedUserToContacts = async (contact: Contact) => {
    if (!user) return;
    
    try {
      // Save to Firestore
      await setDoc(doc(db, `users/${user.uid}/contacts`, contact.phoneNumber), {
        phoneNumber: contact.phoneNumber,
        name: contact.name,
        isAppUser: true,
        appUserId: contact.appUserId,
        lastSynced: new Date()
      });

      // Refresh contacts list
      await loadContacts();

      // Clear search bar
      setSearchText('');

      Alert.alert('Success', `${contact.name} added to contacts`);
    } catch (error: any) {
      console.error('Failed to add contact:', error);
      Alert.alert('Error', 'Failed to add contact. Please try again.');
    }
  };

  const startConversation = async (contactUserId: string) => {
    if (!user || isNavigating) return;
    
    setIsNavigating(true);
    try {
      // Import conversation service dynamically to avoid circular deps
      const { createOrGetConversation } = await import('../../services/conversationService');
      const conversationId = await createOrGetConversation([user.uid, contactUserId], user.uid);
      router.push(`/chat/${conversationId}`);
      
      // Reset navigation flag after navigation completes
      setTimeout(() => {
        setIsNavigating(false);
      }, 1000);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to create conversation: ' + error.message);
      setIsNavigating(false);
    }
  };


  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading contacts...</Text>
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

  // Swipeable Contact Item Component
  const SwipeableContactItem = ({ item }: { item: Contact }) => {
    const translateX = useSharedValue(0);

    const panGesture = Gesture.Pan()
      .activeOffsetX([-10, 10]) // Require 10px horizontal movement to activate
      .failOffsetY([-10, 10]) // Fail if vertical movement exceeds 10px (prioritize scrolling)
      .onUpdate((event) => {
        // Only allow left swipe (negative translation) and limit to -80px
        if (event.translationX < 0) {
          translateX.value = Math.max(event.translationX, -80);
        }
      })
      .onEnd((event) => {
        if (event.translationX < -40) {
          // Threshold reached - reveal delete button (lowered to 40px for easier access)
          translateX.value = withSpring(-80);
        } else {
          // Snap back
          translateX.value = withSpring(0);
        }
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
      backgroundColor: '#fff', // Cover the delete button when not swiped
    }));

    const handleDelete = () => {
      translateX.value = withSpring(0); // Close swipe before deleting
      setTimeout(() => {
        runOnJS(handleDeleteContact)(item);
      }, 300);
    };

    // Only enable swipe-to-delete for contacts that are actually in the user's contact list
    // (both app users and non-app users can be deleted if they're in your contacts)
    const canDelete = item.isInContacts !== false;

    return (
      <View style={styles.swipeableContainer}>
        {/* Delete Button (behind the item) - only for actual contacts */}
        {canDelete && (
          <View style={styles.deleteButtonContainer}>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={24} color="#fff" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Swipeable Content */}
        <GestureDetector gesture={canDelete ? panGesture : Gesture.Pan()}>
          <Animated.View style={[animatedStyle]}>
            <TouchableOpacity 
              onPress={() => {
                // Close swipe if open, otherwise navigate
                if (canDelete && translateX.value < -10) {
                  translateX.value = withSpring(0);
                } else if (item.isAppUser && item.appUserId) {
                  if (canDelete) {
                    translateX.value = 0; // Ensure fully closed
                  }
                  startConversation(item.appUserId);
                }
              }}
              style={[styles.contactItem, !item.isAppUser && styles.contactItemDisabled]}
              disabled={!item.isAppUser}
              activeOpacity={0.7}
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
                <Text style={styles.contactPhone}>{formatPhoneNumber(item.phoneNumber)}</Text>
                {!item.isAppUser && (
                  <Text style={styles.notOnAppText}>Not on aiMessage</Text>
                )}
              </View>
              {item.isAppUser ? (
                item.isInContacts === false ? (
                  // User found in search but not in contacts - show Add button
                  <TouchableOpacity 
                    style={styles.addToContactsButton}
                    onPress={() => handleAddSearchedUserToContacts(item)}
                  >
                    <Text style={styles.addToContactsButtonText}>Add</Text>
                  </TouchableOpacity>
                ) : (
                  // User already in contacts - show Chat button
                  <View style={styles.chatButton}>
                    <Text style={styles.chatButtonText}>Chat</Text>
                  </View>
                )
              ) : (
                <View style={styles.inviteButton}>
                  <Text style={styles.inviteButtonText}>Invite</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {isSearching && (
          <ActivityIndicator size="small" color="#007AFF" style={styles.searchLoading} />
        )}
        {searchText.length > 0 && !isSearching && (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Import all contacts button */}
      <TouchableOpacity 
        style={styles.importButton}
        onPress={handleImportAllContacts}
      >
        <Ionicons name="cloud-download" size={24} color="#fff" />
        <Text style={styles.importButtonText}>Import All Contacts</Text>
      </TouchableOpacity>

      {/* Add contact button with native picker */}
      <TouchableOpacity 
        style={styles.addContactButton}
        onPress={handleAddContact}
      >
        <Ionicons name="person-add" size={24} color="#fff" />
        <Text style={styles.addContactText}>Add Single Contact</Text>
      </TouchableOpacity>
      
      {contacts.length === 0 && (
        <Text style={styles.helpText}>
          Tap "Import All Contacts" to sync all your phone contacts
        </Text>
      )}
      
      {/* Contacts list */}
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
            colors={['#007AFF']}
          />
        }
        renderItem={({ item }) => <SwipeableContactItem item={item} />}
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
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: '#000',
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },
  searchLoading: {
    marginRight: 8,
  },
  importButton: {
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  importButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  addContactButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 15,
    gap: 8,
  },
  addContactText: {
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
    backgroundColor: '#fff',
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
  addToContactsButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  addToContactsButtonText: {
    color: '#fff',
    fontWeight: '600',
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
});

