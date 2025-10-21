import { normalizePhoneNumber } from '../contactService';

describe('Contact Service', () => {
  describe('normalizePhoneNumber', () => {
    it('should normalize US phone numbers correctly', () => {
      expect(normalizePhoneNumber('1234567890')).toBe('+11234567890');
      expect(normalizePhoneNumber('(123) 456-7890')).toBe('+11234567890');
      expect(normalizePhoneNumber('123-456-7890')).toBe('+11234567890');
    });

    it('should preserve numbers with country code', () => {
      expect(normalizePhoneNumber('+11234567890')).toBe('+11234567890');
      expect(normalizePhoneNumber('+447700900123')).toBe('+447700900123');
    });

    it('should handle numbers starting with 1', () => {
      expect(normalizePhoneNumber('11234567890')).toBe('+11234567890');
    });
  });
});

