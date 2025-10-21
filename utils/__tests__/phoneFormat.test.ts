/**
 * Phone Format Utility Tests
 */

import { formatPhoneNumber, formatPhoneNumberOrEmpty } from '../phoneFormat';

describe('formatPhoneNumber', () => {
  test('formats US 11-digit number with country code', () => {
    expect(formatPhoneNumber('+15555555555')).toBe('(555) 555-5555');
    expect(formatPhoneNumber('15555555555')).toBe('(555) 555-5555');
  });

  test('formats US 10-digit number without country code', () => {
    expect(formatPhoneNumber('5555555555')).toBe('(555) 555-5555');
  });

  test('formats number with parentheses and dashes already', () => {
    expect(formatPhoneNumber('(555) 555-5555')).toBe('(555) 555-5555');
  });

  test('formats international numbers', () => {
    expect(formatPhoneNumber('+445555555555')).toBe('+44 (555) 555-5555');
  });

  test('handles empty or invalid input', () => {
    expect(formatPhoneNumber('')).toBe('');
    expect(formatPhoneNumber('abc')).toBe('abc');
  });

  test('handles short numbers', () => {
    expect(formatPhoneNumber('123')).toBe('123');
  });
});

describe('formatPhoneNumberOrEmpty', () => {
  test('formats valid phone number', () => {
    expect(formatPhoneNumberOrEmpty('+15555555555')).toBe('(555) 555-5555');
  });

  test('returns empty string for null or undefined', () => {
    expect(formatPhoneNumberOrEmpty(null)).toBe('');
    expect(formatPhoneNumberOrEmpty(undefined)).toBe('');
    expect(formatPhoneNumberOrEmpty('')).toBe('');
  });
});

