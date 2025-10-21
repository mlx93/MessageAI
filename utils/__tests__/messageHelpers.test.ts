import { formatTimestamp, generateLocalMessageId } from '../messageHelpers';

describe('Message Helpers', () => {
  describe('formatTimestamp', () => {
    it('should format timestamps correctly', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 30 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      expect(formatTimestamp(oneMinuteAgo)).toBe('Just now');
      expect(formatTimestamp(twoHoursAgo)).toBe('2h ago');
    });

    it('should handle invalid timestamps', () => {
      expect(formatTimestamp(null)).toBe('');
      expect(formatTimestamp(undefined)).toBe('');
    });
  });

  describe('generateLocalMessageId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateLocalMessageId();
      const id2 = generateLocalMessageId();
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });
  });
});

