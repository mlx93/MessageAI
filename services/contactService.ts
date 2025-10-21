import * as Contacts from 'expo-contacts';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

export const requestContactsPermission = async (): Promise<boolean> => {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
};

/**
 * Normalize phone number to E.164 format
 */
export const normalizePhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If already has country code (starts with +), return as-is
  if (cleaned.startsWith('+')) return cleaned;
  
  // If starts with 1 (US/Canada), add +
  if (cleaned.startsWith('1') && cleaned.length === 11) return `+${cleaned}`;
  
  // Otherwise assume US and add +1
  return `+1${cleaned}`;
};

/**
 * Match phone numbers against app users (batch queries due to Firestore 'in' limit of 10)
 */
const matchPhoneNumbers = async (phoneNumbers: string[]): Promise<User[]> => {
  const matches: User[] = [];
  
  // Firestore 'in' query limit is 10, batch the queries
  for (let i = 0; i < phoneNumbers.length; i += 10) {
    const batch = phoneNumbers.slice(i, i + 10);
    const q = query(collection(db, 'users'), where('phoneNumber', 'in', batch));
    const snapshot = await getDocs(q);
    snapshot.docs.forEach(doc => matches.push(doc.data() as User));
  }
  
  return matches;
};

/**
 * Import contacts from device and match against app users
 */
export const importContacts = async (userId: string): Promise<void> => {
  const hasPermission = await requestContactsPermission();
  if (!hasPermission) throw new Error('Contacts permission denied');
  
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
  });
  
  if (!data.length) return;
  
  // Extract phone numbers
  const phoneNumbers = data
    .filter(contact => contact.phoneNumbers && contact.phoneNumbers.length > 0)
    .flatMap(contact => 
      contact.phoneNumbers!.map(phone => ({
        name: contact.name || 'Unknown',
        phoneNumber: normalizePhoneNumber(phone.number || '')
      }))
    )
    .filter(c => c.phoneNumber);
  
  // Match against app users
  const uniquePhones = [...new Set(phoneNumbers.map(c => c.phoneNumber))];
  const matchedUsers = await matchPhoneNumbers(uniquePhones);
  
  // Store in user's contacts subcollection
  for (const contact of phoneNumbers) {
    const matchedUser = matchedUsers.find(u => u.phoneNumber === contact.phoneNumber);
    await setDoc(doc(db, `users/${userId}/contacts`, contact.phoneNumber), {
      phoneNumber: contact.phoneNumber,
      name: contact.name,
      isAppUser: !!matchedUser,
      appUserId: matchedUser?.uid || null,
      lastSynced: new Date()
    });
  }
};

/**
 * Get user's contacts from Firestore
 */
export const getUserContacts = async (userId: string) => {
  const snapshot = await getDocs(collection(db, `users/${userId}/contacts`));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Search for a user by phone number
 */
export const searchUserByPhone = async (phoneNumber: string): Promise<User | null> => {
  const normalized = normalizePhoneNumber(phoneNumber);
  const q = query(collection(db, 'users'), where('phoneNumber', '==', normalized));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as User;
};

/**
 * Search ALL app users by name or phone (fuzzy/partial matching)
 * This allows finding users even if they're not in your contacts
 * 
 * @param searchText - Name or phone number to search for
 * @param currentUserId - Current user ID (to exclude from results)
 * @param limit - Maximum number of results to return
 * @returns Array of matching users
 */
export const searchAllUsers = async (
  searchText: string,
  currentUserId: string,
  limit: number = 10
): Promise<User[]> => {
  if (!searchText || searchText.trim().length < 2) {
    return [];
  }

  const searchLower = searchText.toLowerCase().trim();
  
  // Get ALL users from Firestore (in production, you'd want pagination/indexing)
  const snapshot = await getDocs(collection(db, 'users'));
  const allUsers = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User));
  
  // Filter users by partial name or phone match
  const matches = allUsers.filter(user => {
    // Exclude current user
    if (user.uid === currentUserId) return false;
    
    // Match by display name (partial, case-insensitive)
    const displayName = (user.displayName || '').toLowerCase();
    if (displayName.includes(searchLower)) return true;
    
    // Match by first name (partial)
    const firstName = (user.firstName || '').toLowerCase();
    if (firstName.startsWith(searchLower)) return true;
    
    // Match by last name (partial)
    const lastName = (user.lastName || '').toLowerCase();
    if (lastName.startsWith(searchLower)) return true;
    
    // Match by phone number (partial)
    const phoneNumber = (user.phoneNumber || '').replace(/\D/g, '');
    const searchDigits = searchText.replace(/\D/g, '');
    if (searchDigits.length >= 3 && phoneNumber.includes(searchDigits)) return true;
    
    return false;
  });
  
  // Sort by relevance (exact matches first, then starts-with, then contains)
  matches.sort((a, b) => {
    const aName = (a.displayName || '').toLowerCase();
    const bName = (b.displayName || '').toLowerCase();
    
    // Exact match
    if (aName === searchLower) return -1;
    if (bName === searchLower) return 1;
    
    // Starts with
    if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1;
    if (!aName.startsWith(searchLower) && bName.startsWith(searchLower)) return 1;
    
    // Alphabetical
    return aName.localeCompare(bName);
  });
  
  return matches.slice(0, limit);
};

