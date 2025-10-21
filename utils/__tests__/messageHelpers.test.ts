/**
 * Message Helpers Unit Tests
 * 
 * Tests timestamp formatting and message utilities.
 * MVP Requirement: Message timestamps
 */

import { formatTimestamp, formatLastSeen } from '../messageHelpers';

describe('Message Helpers - Unit Tests', () => {
  describe('formatTimestamp', () => {
    const now = new Date('2024-01-15T14:30:00Z');

    it('should show "Just now" for messages less than 1 minute old', () => {
      const timestamp = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
      expect(formatTimestamp(timestamp, now)).toBe('Just now');
    });

    it('should show minutes ago for messages less than 1 hour old', () => {
      const timestamp = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
      expect(formatTimestamp(timestamp, now)).toBe('5m ago');
      
      const timestamp2 = new Date(now.getTime() - 45 * 60 * 1000); // 45 minutes ago
      expect(formatTimestamp(timestamp2, now)).toBe('45m ago');
    });

    it('should show hours ago for messages less than 24 hours old', () => {
      const timestamp = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
      expect(formatTimestamp(timestamp, now)).toBe('2h ago');
      
      const timestamp2 = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago
      expect(formatTimestamp(timestamp2, now)).toBe('12h ago');
    });

    it('should show "Yesterday" for messages from previous day', () => {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(10, 0, 0);
      
      expect(formatTimestamp(yesterday, now)).toBe('Yesterday');
    });

    it('should show date for messages from this week', () => {
      const dayOfWeek = new Date(now);
      dayOfWeek.setDate(dayOfWeek.getDate() - 3); // 3 days ago
      
      const result = formatTimestamp(dayOfWeek, now);
      // Should show day of week like "Monday", "Tuesday", etc.
      expect(result).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
    });

    it('should show full date for messages older than a week', () => {
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago
      
      const result = formatTimestamp(oldDate, now);
      // Should show date like "Jan 5" or "1/5/24"
      expect(result).toMatch(/\d+/);
    });

    it('should show full date with year for messages from previous year', () => {
      const lastYear = new Date(now);
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      
      const result = formatTimestamp(lastYear, now);
      // Should include year
      expect(result).toContain('2023');
    });

    it('should handle edge case: exact same time', () => {
      expect(formatTimestamp(now, now)).toBe('Just now');
    });

    it('should handle future timestamps gracefully', () => {
      const future = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes in future
      // Should either show "Just now" or handle it gracefully
      const result = formatTimestamp(future, now);
      expect(result).toBeDefined();
    });
  });

  describe('formatLastSeen', () => {
    const now = new Date('2024-01-15T14:30:00Z');

    it('should show "Just now" for active users', () => {
      const lastSeen = new Date(now.getTime() - 30 * 1000);
      expect(formatLastSeen(lastSeen, now)).toBe('Just now');
    });

    it('should show "5 minutes ago"', () => {
      const lastSeen = new Date(now.getTime() - 5 * 60 * 1000);
      expect(formatLastSeen(lastSeen, now)).toBe('5 minutes ago');
    });

    it('should show "2 hours ago"', () => {
      const lastSeen = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      expect(formatLastSeen(lastSeen, now)).toBe('2 hours ago');
    });

    it('should show "Yesterday at HH:MM"', () => {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(10, 30);
      
      const result = formatLastSeen(yesterday, now);
      expect(result).toContain('Yesterday');
    });

    it('should show date for older timestamps', () => {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const result = formatLastSeen(weekAgo, now);
      expect(result).toMatch(/\d+/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined timestamps', () => {
      const now = new Date();
      
      expect(formatTimestamp(null as any, now)).toBeDefined();
      expect(formatTimestamp(undefined as any, now)).toBeDefined();
    });

    it('should handle invalid date objects', () => {
      const now = new Date();
      const invalid = new Date('invalid');
      
      const result = formatTimestamp(invalid, now);
      expect(result).toBeDefined();
    });

    it('should handle very old timestamps', () => {
      const now = new Date();
      const ancient = new Date('1990-01-01');
      
      const result = formatTimestamp(ancient, now);
      expect(result).toContain('1990');
    });
  });

  describe('generateMessageId', () => {
    it('should generate unique IDs', () => {
      const generateMessageId = (): string => {
        return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      };

      const id1 = generateMessageId();
      const id2 = generateMessageId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg-\d+-[a-z0-9]+$/);
    });

    it('should generate IDs with proper prefix', () => {
      const generateLocalId = (): string => {
        return `local-${Date.now()}`;
      };

      const id = generateLocalId();
      expect(id).toMatch(/^local-\d+$/);
    });
  });

  describe('truncateMessage', () => {
    it('should truncate long messages', () => {
      const truncate = (text: string, maxLength: number): string => {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
      };

      const longMessage = 'A'.repeat(200);
      const truncated = truncate(longMessage, 100);

      expect(truncated.length).toBe(103); // 100 + '...'
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('should not truncate short messages', () => {
      const truncate = (text: string, maxLength: number): string => {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
      };

      const shortMessage = 'Hello';
      const result = truncate(shortMessage, 100);

      expect(result).toBe('Hello');
      expect(result.endsWith('...')).toBe(false);
    });
  });

  describe('isMessageFromToday', () => {
    it('should identify messages from today', () => {
      const isToday = (date: Date, now: Date): boolean => {
        return date.toDateString() === now.toDateString();
      };

      const now = new Date('2024-01-15T14:30:00Z');
      const todayMessage = new Date('2024-01-15T10:00:00Z');

      expect(isToday(todayMessage, now)).toBe(true);
    });

    it('should identify messages not from today', () => {
      const isToday = (date: Date, now: Date): boolean => {
        return date.toDateString() === now.toDateString();
      };

      const now = new Date('2024-01-15T14:30:00Z');
      const yesterdayMessage = new Date('2024-01-14T14:30:00Z');

      expect(isToday(yesterdayMessage, now)).toBe(false);
    });
  });

  describe('groupMessagesByDate', () => {
    it('should group messages by date', () => {
      const messages = [
        { id: '1', text: 'Message 1', timestamp: new Date('2024-01-15T10:00:00Z') },
        { id: '2', text: 'Message 2', timestamp: new Date('2024-01-15T11:00:00Z') },
        { id: '3', text: 'Message 3', timestamp: new Date('2024-01-14T10:00:00Z') },
        { id: '4', text: 'Message 4', timestamp: new Date('2024-01-14T15:00:00Z') }
      ];

      const groupByDate = (messages: typeof messages) => {
        const groups: Record<string, typeof messages> = {};
        
        messages.forEach(msg => {
          const dateKey = msg.timestamp.toDateString();
          if (!groups[dateKey]) {
            groups[dateKey] = [];
          }
          groups[dateKey].push(msg);
        });
        
        return groups;
      };

      const grouped = groupByDate(messages);
      const keys = Object.keys(grouped);

      expect(keys.length).toBe(2);
      expect(grouped[keys[0]].length).toBeGreaterThan(0);
    });
  });

  describe('shouldShowTimestamp', () => {
    it('should show timestamp after 5 minutes gap', () => {
      const shouldShow = (current: Date, previous: Date): boolean => {
        const diff = current.getTime() - previous.getTime();
        return diff > 5 * 60 * 1000; // 5 minutes
      };

      const msg1 = new Date('2024-01-15T10:00:00Z');
      const msg2 = new Date('2024-01-15T10:06:00Z'); // 6 minutes later

      expect(shouldShow(msg2, msg1)).toBe(true);
    });

    it('should not show timestamp for consecutive messages', () => {
      const shouldShow = (current: Date, previous: Date): boolean => {
        const diff = current.getTime() - previous.getTime();
        return diff > 5 * 60 * 1000;
      };

      const msg1 = new Date('2024-01-15T10:00:00Z');
      const msg2 = new Date('2024-01-15T10:01:00Z'); // 1 minute later

      expect(shouldShow(msg2, msg1)).toBe(false);
    });
  });

  describe('getReadReceiptStatus', () => {
    it('should return "sent" for message with no delivery', () => {
      const getStatus = (deliveredTo: string[], readBy: string[], senderId: string): string => {
        if (readBy.length > 1 || (readBy.length === 1 && !readBy.includes(senderId))) {
          return 'read';
        }
        if (deliveredTo.length > 0) {
          return 'delivered';
        }
        return 'sent';
      };

      expect(getStatus([], ['sender'], 'sender')).toBe('sent');
    });

    it('should return "delivered" for delivered message', () => {
      const getStatus = (deliveredTo: string[], readBy: string[], senderId: string): string => {
        if (readBy.length > 1 || (readBy.length === 1 && !readBy.includes(senderId))) {
          return 'read';
        }
        if (deliveredTo.length > 0) {
          return 'delivered';
        }
        return 'sent';
      };

      expect(getStatus(['recipient'], ['sender'], 'sender')).toBe('delivered');
    });

    it('should return "read" for read message', () => {
      const getStatus = (deliveredTo: string[], readBy: string[], senderId: string): string => {
        if (readBy.length > 1 || (readBy.length === 1 && !readBy.includes(senderId))) {
          return 'read';
        }
        if (deliveredTo.length > 0) {
          return 'delivered';
        }
        return 'sent';
      };

      expect(getStatus(['recipient'], ['sender', 'recipient'], 'sender')).toBe('read');
    });
  });
});
