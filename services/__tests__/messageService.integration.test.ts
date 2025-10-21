/**
 * Message Service Integration Tests
 * 
 * Tests real-time message delivery, read receipts, and delivery tracking.
 * These are CRITICAL MVP features for MessageAI.
 * 
 * MVP Requirements:
 * - Real-time message delivery between 2+ users
 * - Message persistence (survives app restarts)
 * - Optimistic UI updates (messages appear instantly)
 * - Message read receipts
 * - Message timestamps
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
  addDoc,
  updateDoc,
  onSnapshot,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { setupEmulator, teardownEmulator } from './setup/emulator';

describe('Message Service - Integration Tests', () => {
  let db: any;
  let cleanup: Array<() => void> = [];

  beforeAll(() => {
    const emulator = setupEmulator();
    db = emulator.db;
  });

  afterAll(async () => {
    // Cleanup listeners
    cleanup.forEach(fn => fn());
    await teardownEmulator();
  });

  afterEach(() => {
    // Clean up listeners after each test
    cleanup.forEach(fn => fn());
    cleanup = [];
  });

  describe('Real-Time Message Delivery', () => {
    it('should send a text message to Firestore', async () => {
      const conversationId = `conv-${Date.now()}`;
      const senderId = 'user1';
      const messageText = 'Hello, World!';

      // Send message
      const messageData = {
        conversationId,
        senderId,
        text: messageText,
        mediaUrl: '',
        timestamp: Timestamp.now(),
        deliveredTo: [],
        readBy: [senderId], // Sender has read their own message
        status: 'sent'
      };

      const messageRef = await addDoc(collection(db, 'messages'), messageData);

      // Verify message was created
      const messageDoc = await getDoc(messageRef);
      expect(messageDoc.exists()).toBe(true);
      expect(messageDoc.data()?.text).toBe(messageText);
      expect(messageDoc.data()?.senderId).toBe(senderId);
    });

    it('should receive messages in real-time via onSnapshot', (done) => {
      const conversationId = `conv-realtime-${Date.now()}`;
      const senderId = 'user1';
      let messageCount = 0;

      // Set up real-time listener
      const messagesQuery = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        messageCount = snapshot.docs.length;
        
        if (messageCount > 0) {
          expect(snapshot.docs[0].data().text).toBe('Test message');
          unsubscribe();
          done();
        }
      });

      cleanup.push(unsubscribe);

      // Send a message after listener is set up
      setTimeout(async () => {
        await addDoc(collection(db, 'messages'), {
          conversationId,
          senderId,
          text: 'Test message',
          timestamp: Timestamp.now(),
          deliveredTo: [],
          readBy: [senderId]
        });
      }, 100);
    });

    it('should maintain message order by timestamp', async () => {
      const conversationId = `conv-order-${Date.now()}`;
      
      // Send messages in rapid succession
      const messages = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
      
      for (let i = 0; i < messages.length; i++) {
        await addDoc(collection(db, 'messages'), {
          conversationId,
          senderId: 'user1',
          text: messages[i],
          timestamp: Timestamp.now(),
          deliveredTo: [],
          readBy: ['user1']
        });
        // Small delay to ensure timestamp ordering
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Query messages in order
      const messagesQuery = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        orderBy('timestamp', 'asc')
      );

      const snapshot = await getDocs(messagesQuery);
      const retrievedMessages = snapshot.docs.map(doc => doc.data().text);

      expect(retrievedMessages).toEqual(messages);
    });

    it('should support rapid-fire messages (20+ messages)', async () => {
      const conversationId = `conv-rapid-${Date.now()}`;
      const messageCount = 25;
      
      // Send 25 messages rapidly
      const promises = [];
      for (let i = 0; i < messageCount; i++) {
        promises.push(
          addDoc(collection(db, 'messages'), {
            conversationId,
            senderId: 'user1',
            text: `Message ${i + 1}`,
            timestamp: Timestamp.now(),
            deliveredTo: [],
            readBy: ['user1']
          })
        );
      }

      await Promise.all(promises);

      // Verify all messages were created
      const messagesQuery = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId)
      );

      const snapshot = await getDocs(messagesQuery);
      expect(snapshot.docs.length).toBe(messageCount);
    });
  });

  describe('Message Read Receipts', () => {
    it('should mark message as delivered to recipient', async () => {
      const conversationId = `conv-delivered-${Date.now()}`;
      const messageId = `msg-${Date.now()}`;

      // Create message
      await setDoc(doc(db, 'messages', messageId), {
        conversationId,
        senderId: 'user1',
        text: 'Test message',
        timestamp: Timestamp.now(),
        deliveredTo: [],
        readBy: ['user1']
      });

      // Mark as delivered to user2
      await updateDoc(doc(db, 'messages', messageId), {
        deliveredTo: arrayUnion('user2')
      });

      // Verify delivery status
      const messageDoc = await getDoc(doc(db, 'messages', messageId));
      const deliveredTo = messageDoc.data()?.deliveredTo || [];
      expect(deliveredTo).toContain('user2');
    });

    it('should mark message as read by recipient', async () => {
      const conversationId = `conv-read-${Date.now()}`;
      const messageId = `msg-read-${Date.now()}`;

      // Create message
      await setDoc(doc(db, 'messages', messageId), {
        conversationId,
        senderId: 'user1',
        text: 'Test message',
        timestamp: Timestamp.now(),
        deliveredTo: ['user2'],
        readBy: ['user1'] // Sender has read
      });

      // Mark as read by user2
      await updateDoc(doc(db, 'messages', messageId), {
        readBy: arrayUnion('user2')
      });

      // Verify read status
      const messageDoc = await getDoc(doc(db, 'messages', messageId));
      const readBy = messageDoc.data()?.readBy || [];
      expect(readBy).toContain('user1'); // Sender
      expect(readBy).toContain('user2'); // Recipient
    });

    it('should batch mark multiple messages as read', async () => {
      const conversationId = `conv-batch-read-${Date.now()}`;
      
      // Create 5 messages
      const messageIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const messageRef = await addDoc(collection(db, 'messages'), {
          conversationId,
          senderId: 'user1',
          text: `Message ${i + 1}`,
          timestamp: Timestamp.now(),
          deliveredTo: ['user2'],
          readBy: ['user1']
        });
        messageIds.push(messageRef.id);
      }

      // Mark all as read by user2
      const promises = messageIds.map(id =>
        updateDoc(doc(db, 'messages', id), {
          readBy: arrayUnion('user2')
        })
      );

      await Promise.all(promises);

      // Verify all are read
      for (const id of messageIds) {
        const messageDoc = await getDoc(doc(db, 'messages', id));
        const readBy = messageDoc.data()?.readBy || [];
        expect(readBy).toContain('user2');
      }
    });
  });

  describe('Group Chat Read Receipts', () => {
    it('should track read status per user in group chat', async () => {
      const conversationId = `group-${Date.now()}`;
      const messageId = `group-msg-${Date.now()}`;

      // Create message in group chat
      await setDoc(doc(db, 'messages', messageId), {
        conversationId,
        senderId: 'user1',
        text: 'Group message',
        timestamp: Timestamp.now(),
        deliveredTo: [],
        readBy: ['user1'] // Only sender has read
      });

      // User2 reads the message
      await updateDoc(doc(db, 'messages', messageId), {
        readBy: arrayUnion('user2')
      });

      // User3 reads the message
      await updateDoc(doc(db, 'messages', messageId), {
        readBy: arrayUnion('user3')
      });

      // Verify all three users are in readBy array
      const messageDoc = await getDoc(doc(db, 'messages', messageId));
      const readBy = messageDoc.data()?.readBy || [];
      
      expect(readBy.length).toBe(3);
      expect(readBy).toContain('user1');
      expect(readBy).toContain('user2');
      expect(readBy).toContain('user3');
    });

    it('should calculate unread count for group members', async () => {
      const conversationId = `group-unread-${Date.now()}`;
      
      // Send 3 messages
      const messageIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const messageRef = await addDoc(collection(db, 'messages'), {
          conversationId,
          senderId: 'user1',
          text: `Group message ${i + 1}`,
          timestamp: Timestamp.now(),
          deliveredTo: ['user2', 'user3'],
          readBy: ['user1'] // Only sender has read
        });
        messageIds.push(messageRef.id);
      }

      // User2 reads first 2 messages
      await updateDoc(doc(db, 'messages', messageIds[0]), {
        readBy: arrayUnion('user2')
      });
      await updateDoc(doc(db, 'messages', messageIds[1]), {
        readBy: arrayUnion('user2')
      });

      // Count unread for user2
      const messagesQuery = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId)
      );

      const snapshot = await getDocs(messagesQuery);
      const unreadForUser2 = snapshot.docs.filter(doc => {
        const readBy = doc.data().readBy || [];
        return !readBy.includes('user2');
      });

      expect(unreadForUser2.length).toBe(1); // Last message is unread

      // Count unread for user3 (hasn't read any)
      const unreadForUser3 = snapshot.docs.filter(doc => {
        const readBy = doc.data().readBy || [];
        return !readBy.includes('user3');
      });

      expect(unreadForUser3.length).toBe(3); // All messages unread
    });
  });

  describe('Optimistic UI Support', () => {
    it('should handle local message ID before server confirmation', async () => {
      const localId = `local-${Date.now()}`;
      const conversationId = `conv-optimistic-${Date.now()}`;

      // Simulate optimistic UI: store with localId first
      const localMessage = {
        localId,
        conversationId,
        senderId: 'user1',
        text: 'Optimistic message',
        timestamp: Timestamp.now(),
        deliveredTo: [],
        readBy: ['user1'],
        status: 'sending'
      };

      // Add to Firestore (simulating server save)
      const messageRef = await addDoc(collection(db, 'messages'), localMessage);

      // Update status to 'sent' with server ID
      await updateDoc(messageRef, {
        status: 'sent',
        serverId: messageRef.id
      });

      // Verify message exists with both IDs
      const messageDoc = await getDoc(messageRef);
      expect(messageDoc.data()?.localId).toBe(localId);
      expect(messageDoc.data()?.serverId).toBe(messageRef.id);
      expect(messageDoc.data()?.status).toBe('sent');
    });
  });

  describe('Message Timestamps', () => {
    it('should store timestamp as Firestore Timestamp', async () => {
      const conversationId = `conv-timestamp-${Date.now()}`;

      const messageRef = await addDoc(collection(db, 'messages'), {
        conversationId,
        senderId: 'user1',
        text: 'Timestamped message',
        timestamp: Timestamp.now(),
        deliveredTo: [],
        readBy: ['user1']
      });

      const messageDoc = await getDoc(messageRef);
      const timestamp = messageDoc.data()?.timestamp;

      // Verify it's a Firestore Timestamp
      expect(timestamp).toBeInstanceOf(Timestamp);
      expect(timestamp.toDate()).toBeInstanceOf(Date);
    });

    it('should support timestamp-based queries', async () => {
      const conversationId = `conv-time-query-${Date.now()}`;
      
      // Send message now
      const now = Timestamp.now();
      await addDoc(collection(db, 'messages'), {
        conversationId,
        senderId: 'user1',
        text: 'Old message',
        timestamp: now,
        deliveredTo: [],
        readBy: ['user1']
      });

      // Wait 100ms
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send another message
      const later = Timestamp.now();
      await addDoc(collection(db, 'messages'), {
        conversationId,
        senderId: 'user1',
        text: 'New message',
        timestamp: later,
        deliveredTo: [],
        readBy: ['user1']
      });

      // Query messages after 'now'
      const messagesQuery = query(
        collection(db, 'messages'),
        where('conversationId', '==', conversationId),
        where('timestamp', '>', now)
      );

      const snapshot = await getDocs(messagesQuery);
      expect(snapshot.docs.length).toBe(1);
      expect(snapshot.docs[0].data().text).toBe('New message');
    });
  });
});

