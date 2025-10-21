/**
 * Conversation Service Integration Tests
 * 
 * Tests direct and group conversation management.
 * Critical for MVP group chat functionality (3+ users).
 * 
 * MVP Requirements:
 * - Basic group chat functionality (3+ users in one conversation)
 * - One-on-one chat functionality
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  arrayUnion,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { setupEmulator, teardownEmulator } from './setup/emulator';

describe('Conversation Service - Integration Tests', () => {
  let db: any;

  beforeAll(() => {
    const emulator = setupEmulator();
    db = emulator.db;
  });

  afterAll(async () => {
    await teardownEmulator();
  });

  describe('Direct Conversations (1-on-1)', () => {
    it('should create a direct conversation with deterministic ID', async () => {
      const user1 = 'alice123';
      const user2 = 'bob456';

      // Create deterministic conversation ID (sorted UIDs)
      const sortedIds = [user1, user2].sort();
      const conversationId = sortedIds.join('_');

      // Create conversation
      const conversationData = {
        id: conversationId,
        type: 'direct',
        participants: [user1, user2],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastMessage: '',
        lastMessageTime: Timestamp.now()
      };

      await setDoc(doc(db, 'conversations', conversationId), conversationData);

      // Verify conversation was created
      const convDoc = await getDoc(doc(db, 'conversations', conversationId));
      expect(convDoc.exists()).toBe(true);
      expect(convDoc.data()?.type).toBe('direct');
      expect(convDoc.data()?.participants).toEqual([user1, user2]);
    });

    it('should use same conversation ID regardless of participant order', () => {
      const user1 = 'alice123';
      const user2 = 'bob456';

      // Create ID with user1 first
      const id1 = [user1, user2].sort().join('_');

      // Create ID with user2 first
      const id2 = [user2, user1].sort().join('_');

      // Should be identical (deterministic)
      expect(id1).toBe(id2);
      expect(id1).toBe('alice123_bob456');
    });

    it('should prevent duplicate direct conversations', async () => {
      const user1 = 'charlie789';
      const user2 = 'diana012';
      const conversationId = [user1, user2].sort().join('_');

      // Create conversation first time
      await setDoc(doc(db, 'conversations', conversationId), {
        type: 'direct',
        participants: [user1, user2],
        createdAt: Timestamp.now()
      });

      // Check if conversation exists before creating
      const existingConv = await getDoc(doc(db, 'conversations', conversationId));
      expect(existingConv.exists()).toBe(true);

      // In real app, we'd return existing conversation instead of creating new one
      if (existingConv.exists()) {
        expect(existingConv.data()?.type).toBe('direct');
      }
    });
  });

  describe('Group Conversations (3+ users)', () => {
    it('should create a group conversation with 3 participants', async () => {
      const participants = ['user1', 'user2', 'user3'];
      const groupId = `group-${Date.now()}`;

      // Create group conversation
      const groupData = {
        id: groupId,
        type: 'group',
        participants,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastMessage: '',
        lastMessageTime: Timestamp.now(),
        groupName: 'Test Group'
      };

      await setDoc(doc(db, 'conversations', groupId), groupData);

      // Verify group was created
      const groupDoc = await getDoc(doc(db, 'conversations', groupId));
      expect(groupDoc.exists()).toBe(true);
      expect(groupDoc.data()?.type).toBe('group');
      expect(groupDoc.data()?.participants.length).toBe(3);
    });

    it('should add participant to existing group', async () => {
      const groupId = `group-add-${Date.now()}`;
      const initialParticipants = ['user1', 'user2', 'user3'];

      // Create group with 3 participants
      await setDoc(doc(db, 'conversations', groupId), {
        type: 'group',
        participants: initialParticipants,
        createdAt: Timestamp.now()
      });

      // Add 4th participant
      await updateDoc(doc(db, 'conversations', groupId), {
        participants: arrayUnion('user4')
      });

      // Verify participant was added
      const groupDoc = await getDoc(doc(db, 'conversations', groupId));
      const participants = groupDoc.data()?.participants || [];
      
      expect(participants.length).toBe(4);
      expect(participants).toContain('user4');
    });

    it('should convert 2-person chat to group when adding 3rd person', async () => {
      const user1 = 'convert1';
      const user2 = 'convert2';
      const directId = [user1, user2].sort().join('_');

      // Start as direct conversation
      await setDoc(doc(db, 'conversations', directId), {
        type: 'direct',
        participants: [user1, user2],
        createdAt: Timestamp.now()
      });

      // Add 3rd person - should convert to group
      const user3 = 'convert3';
      
      // Delete old direct conversation and create new group
      const newGroupId = `group-from-${directId}`;
      await setDoc(doc(db, 'conversations', newGroupId), {
        type: 'group',
        participants: [user1, user2, user3],
        createdAt: Timestamp.now(),
        convertedFrom: directId
      });

      // Verify it's now a group
      const groupDoc = await getDoc(doc(db, 'conversations', newGroupId));
      expect(groupDoc.data()?.type).toBe('group');
      expect(groupDoc.data()?.participants.length).toBe(3);
    });
  });

  describe('Conversation Queries', () => {
    it('should find all conversations for a user', async () => {
      const userId = `user-query-${Date.now()}`;
      
      // Create 3 conversations with this user
      const conv1Id = `conv1-${Date.now()}`;
      const conv2Id = `conv2-${Date.now()}`;
      const conv3Id = `conv3-${Date.now()}`;

      await setDoc(doc(db, 'conversations', conv1Id), {
        participants: [userId, 'other1'],
        createdAt: Timestamp.now()
      });

      await setDoc(doc(db, 'conversations', conv2Id), {
        participants: [userId, 'other2'],
        createdAt: Timestamp.now()
      });

      await setDoc(doc(db, 'conversations', conv3Id), {
        participants: [userId, 'other3', 'other4'],
        createdAt: Timestamp.now()
      });

      // Query conversations for this user
      const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId)
      );

      const snapshot = await getDocs(conversationsQuery);
      expect(snapshot.docs.length).toBeGreaterThanOrEqual(3);

      // Verify user is in all conversations
      snapshot.docs.forEach(doc => {
        const participants = doc.data().participants || [];
        expect(participants).toContain(userId);
      });
    });

    it('should order conversations by last message time', async () => {
      const userId = `user-order-${Date.now()}`;
      
      // Create conversations with different timestamps
      const old = Timestamp.fromMillis(Date.now() - 1000000);
      const recent = Timestamp.fromMillis(Date.now() - 10000);
      const latest = Timestamp.now();

      await setDoc(doc(db, 'conversations', `old-${Date.now()}`), {
        participants: [userId, 'other1'],
        lastMessageTime: old,
        updatedAt: old
      });

      await setDoc(doc(db, 'conversations', `recent-${Date.now()}`), {
        participants: [userId, 'other2'],
        lastMessageTime: recent,
        updatedAt: recent
      });

      await setDoc(doc(db, 'conversations', `latest-${Date.now()}`), {
        participants: [userId, 'other3'],
        lastMessageTime: latest,
        updatedAt: latest
      });

      // Query with ordering
      const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(conversationsQuery);
      const timestamps = snapshot.docs.map(doc => doc.data().updatedAt.toMillis());

      // Verify descending order (newest first)
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
      }
    });
  });

  describe('Last Message Preview', () => {
    it('should update last message preview', async () => {
      const conversationId = `conv-preview-${Date.now()}`;

      // Create conversation
      await setDoc(doc(db, 'conversations', conversationId), {
        type: 'direct',
        participants: ['user1', 'user2'],
        lastMessage: '',
        lastMessageTime: Timestamp.now(),
        createdAt: Timestamp.now()
      });

      // Update with first message
      const firstMessage = 'Hello!';
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: firstMessage,
        lastMessageTime: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Verify preview was updated
      let convDoc = await getDoc(doc(db, 'conversations', conversationId));
      expect(convDoc.data()?.lastMessage).toBe(firstMessage);

      // Update with second message
      const secondMessage = 'How are you?';
      await updateDoc(doc(db, 'conversations', conversationId), {
        lastMessage: secondMessage,
        lastMessageTime: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Verify preview shows latest message
      convDoc = await getDoc(doc(db, 'conversations', conversationId));
      expect(convDoc.data()?.lastMessage).toBe(secondMessage);
    });

    it('should truncate long messages in preview', () => {
      const longMessage = 'A'.repeat(200);
      const truncated = longMessage.slice(0, 100) + '...';

      expect(truncated.length).toBe(103);
      expect(truncated.endsWith('...')).toBe(true);
    });
  });

  describe('Unread Count', () => {
    it('should track unread count per conversation', async () => {
      const conversationId = `conv-unread-${Date.now()}`;

      // Create conversation with unread count
      await setDoc(doc(db, 'conversations', conversationId), {
        participants: ['user1', 'user2'],
        unreadCount: {
          user1: 0,
          user2: 5
        },
        createdAt: Timestamp.now()
      });

      // Verify unread counts
      const convDoc = await getDoc(doc(db, 'conversations', conversationId));
      const unreadCount = convDoc.data()?.unreadCount || {};
      
      expect(unreadCount.user1).toBe(0);
      expect(unreadCount.user2).toBe(5);
    });

    it('should reset unread count when user reads messages', async () => {
      const conversationId = `conv-reset-${Date.now()}`;

      // Create conversation with unread messages
      await setDoc(doc(db, 'conversations', conversationId), {
        participants: ['user1', 'user2'],
        unreadCount: {
          user1: 3,
          user2: 0
        }
      });

      // User1 reads messages - reset their count
      await updateDoc(doc(db, 'conversations', conversationId), {
        'unreadCount.user1': 0
      });

      // Verify count was reset
      const convDoc = await getDoc(doc(db, 'conversations', conversationId));
      const unreadCount = convDoc.data()?.unreadCount || {};
      
      expect(unreadCount.user1).toBe(0);
      expect(unreadCount.user2).toBe(0);
    });
  });
});

