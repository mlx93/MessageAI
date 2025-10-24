/**
 * Conversation Service Unit Tests
 * 
 * Tests for conversation update guard logic and determinism
 */

import { updateConversationLastMessage, recalculateLastMessage } from '../conversationService';
import { doc, getDoc, updateDoc, getDocs, query, collection } from 'firebase/firestore';
import { db } from '../firebase';

// Mock Firebase
jest.mock('../firebase', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  collection: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => 'TIMESTAMP'),
}));

describe('Conversation Service - Guard Logic', () => {
  const mockDoc = doc as jest.MockedFunction<typeof doc>;
  const mockGetDoc = getDoc as jest.MockedFunction<typeof getDoc>;
  const mockUpdateDoc = updateDoc as jest.MockedFunction<typeof updateDoc>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateConversationLastMessage guard', () => {
    it('should accept update when no current lastMessageId exists', async () => {
      // Setup: conversation with no lastMessageId
      mockDoc.mockReturnValue({} as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          lastMessage: { text: 'Old message', senderId: 'user1' }
          // No lastMessageId field
        })
      } as any);

      // Test: new message should be accepted
      await updateConversationLastMessage('conv1', 'New message', 'user1', 'msg-123');

      // Verify: updateDoc was called
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should accept update when new messageId is greater than current', async () => {
      // Setup: conversation with older messageId
      mockDoc.mockReturnValue({} as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          lastMessage: { text: 'Old message', senderId: 'user1' },
          lastMessageId: 'msg-100'
        })
      } as any);

      // Test: newer message should be accepted (lexicographic: msg-200 > msg-100)
      await updateConversationLastMessage('conv1', 'New message', 'user1', 'msg-200');

      // Verify: updateDoc was called
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should reject update when new messageId is less than current', async () => {
      // Setup: conversation with newer messageId
      mockDoc.mockReturnValue({} as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          lastMessage: { text: 'New message', senderId: 'user1' },
          lastMessageId: 'msg-200'
        })
      } as any);

      // Test: older message should be rejected (lexicographic: msg-100 < msg-200)
      await updateConversationLastMessage('conv1', 'Old message', 'user1', 'msg-100');

      // Verify: updateDoc was NOT called
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should reject update when messageIds are equal', async () => {
      // Setup: conversation with same messageId
      mockDoc.mockReturnValue({} as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          lastMessage: { text: 'Message', senderId: 'user1' },
          lastMessageId: 'msg-123'
        })
      } as any);

      // Test: duplicate message should be rejected
      await updateConversationLastMessage('conv1', 'Message', 'user1', 'msg-123');

      // Verify: updateDoc was NOT called
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('should handle UUID v4 ordering correctly', async () => {
      // UUID v4 is time-sortable lexicographically
      const olderUuid = '550e8400-e29b-41d4-a716-446655440000';
      const newerUuid = '650e8400-e29b-41d4-a716-446655440000';

      // Setup: conversation with older UUID
      mockDoc.mockReturnValue({} as any);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          lastMessage: { text: 'Old message', senderId: 'user1' },
          lastMessageId: olderUuid
        })
      } as any);

      // Test: newer UUID should be accepted
      await updateConversationLastMessage('conv1', 'New message', 'user1', newerUuid);

      // Verify: updateDoc was called
      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should handle concurrent updates (race condition)', async () => {
      // Simulate: Two devices send messages with close timestamps
      const msg1 = '550e8400-e29b-41d4-a716-446655440000';
      const msg2 = '550e8400-e29b-41d4-a716-446655440001'; // 1 nanosecond later

      // Setup: msg1 arrives first
      mockDoc.mockReturnValue({} as any);
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            lastMessage: { text: 'Message 1', senderId: 'user1' },
            lastMessageId: msg1
          })
        } as any)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            lastMessage: { text: 'Message 1', senderId: 'user1' },
            lastMessageId: msg1
          })
        } as any);

      // Test: msg2 arrives (should be accepted as it's lexicographically greater)
      await updateConversationLastMessage('conv1', 'Message 2', 'user2', msg2);

      // Verify: update accepted
      expect(mockUpdateDoc).toHaveBeenCalled();

      // Test: msg1 arrives late (should be rejected)
      jest.clearAllMocks();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          lastMessage: { text: 'Message 2', senderId: 'user2' },
          lastMessageId: msg2
        })
      } as any);

      await updateConversationLastMessage('conv1', 'Message 1', 'user1', msg1);

      // Verify: stale update rejected
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('recalculateLastMessage', () => {
    it('should find the most recent non-deleted message', async () => {
      // Mock getDocs to return messages with different deletion states
      const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
      const mockQuery = query as jest.MockedFunction<typeof query>;
      const mockCollection = collection as jest.MockedFunction<typeof collection>;
      
      // Mock query and collection
      mockQuery.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);
      
      // Mock getDocs to return messages where some are deleted by user1
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            data: () => ({
              text: 'Message 3',
              senderId: 'user2',
              timestamp: { toDate: () => new Date('2023-01-03') },
              deletedBy: ['user1'] // Deleted by user1
            })
          },
          {
            data: () => ({
              text: 'Message 2',
              senderId: 'user1',
              timestamp: { toDate: () => new Date('2023-01-02') },
              deletedBy: [] // Not deleted
            })
          },
          {
            data: () => ({
              text: 'Message 1',
              senderId: 'user2',
              timestamp: { toDate: () => new Date('2023-01-01') },
              deletedBy: ['user1'] // Deleted by user1
            })
          }
        ]
      } as any);

      const result = await recalculateLastMessage('conv1', 'user1');
      
      expect(result).toEqual({
        text: 'Message 2',
        senderId: 'user1',
        timestamp: new Date('2023-01-02')
      });
    });

    it('should return null when all messages are deleted', async () => {
      const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
      const mockQuery = query as jest.MockedFunction<typeof query>;
      const mockCollection = collection as jest.MockedFunction<typeof collection>;
      
      mockQuery.mockReturnValue({} as any);
      mockCollection.mockReturnValue({} as any);
      
      // All messages deleted by user1
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            data: () => ({
              text: 'Message 1',
              senderId: 'user2',
              timestamp: { toDate: () => new Date('2023-01-01') },
              deletedBy: ['user1']
            })
          }
        ]
      } as any);

      const result = await recalculateLastMessage('conv1', 'user1');
      
      expect(result).toBeNull();
    });
  });
});
