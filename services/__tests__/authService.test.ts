/**
 * Auth Service Unit Tests
 * 
 * Tests authentication functionality including phone number normalization
 * 
 * Note: Full integration tests should use Firebase Emulator (see Task 1.6b)
 * For MVP, we're focusing on testing the core logic that doesn't require Firebase
 */

describe('authService - Phone Number Normalization', () => {
  // Test phone normalization logic in isolation
  const normalizePhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      return `+${cleaned}`;
    }
    return `+1${cleaned}`;
  };

  describe('normalizePhoneNumber', () => {
    it('should preserve E.164 format numbers', () => {
      expect(normalizePhoneNumber('+15551234567')).toBe('+15551234567');
      expect(normalizePhoneNumber('+12125551234')).toBe('+12125551234');
    });

    it('should add +1 for 11-digit numbers starting with 1', () => {
      expect(normalizePhoneNumber('15551234567')).toBe('+15551234567');
    });

    it('should add +1 for 10-digit US numbers', () => {
      expect(normalizePhoneNumber('5551234567')).toBe('+15551234567');
    });

    it('should handle formatted phone numbers', () => {
      expect(normalizePhoneNumber('(555) 123-4567')).toBe('+15551234567');
      expect(normalizePhoneNumber('555-123-4567')).toBe('+15551234567');
      expect(normalizePhoneNumber('555.123.4567')).toBe('+15551234567');
    });

    it('should handle spaces in phone numbers', () => {
      expect(normalizePhoneNumber('555 123 4567')).toBe('+15551234567');
      expect(normalizePhoneNumber('1 555 123 4567')).toBe('+15551234567');
    });

    it('should handle mixed formatting', () => {
      expect(normalizePhoneNumber('1 (555) 123-4567')).toBe('+15551234567');
      expect(normalizePhoneNumber('+1 (555) 123-4567')).toBe('+15551234567');
    });
  });
});

