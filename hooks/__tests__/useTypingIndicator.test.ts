/**
 * Typing Indicator Hooks Tests
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useTypingIndicator, useTypingStatus } from '../useTypingIndicator';

// Mock Firebase
jest.mock('../../services/firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ id: 'mock-doc' })),
  setDoc: jest.fn(() => Promise.resolve()),
  collection: jest.fn(() => ({ id: 'mock-collection' })),
  onSnapshot: jest.fn((ref, callback) => {
    // Return unsubscribe function
    return jest.fn();
  }),
  serverTimestamp: jest.fn(() => new Date()),
}));

describe('useTypingIndicator', () => {
  const mockConversationId = 'conv123';
  const mockUserId = 'user123';
  const mockDisplayName = 'John Doe';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update typing status when hasText changes to true', async () => {
    const { setDoc } = require('firebase/firestore');
    
    const { result, rerender } = renderHook(
      ({ hasText }) => useTypingIndicator(mockConversationId, mockUserId, mockDisplayName, hasText),
      { initialProps: { hasText: false } }
    );

    // Initially no typing
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isTyping: false })
    );

    // User starts typing
    await act(async () => {
      rerender({ hasText: true });
    });

    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isTyping: true, displayName: mockDisplayName })
    );
  });

  it('should update typing status when hasText changes to false', async () => {
    const { setDoc } = require('firebase/firestore');
    
    const { rerender } = renderHook(
      ({ hasText }) => useTypingIndicator(mockConversationId, mockUserId, mockDisplayName, hasText),
      { initialProps: { hasText: true } }
    );

    jest.clearAllMocks();

    // User clears text
    await act(async () => {
      rerender({ hasText: false });
    });

    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isTyping: false })
    );
  });
});

describe('useTypingStatus', () => {
  const mockConversationId = 'conv123';
  const mockCurrentUserId = 'user123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty string when no one is typing', () => {
    const { onSnapshot } = require('firebase/firestore');
    
    onSnapshot.mockImplementation((ref: any, callback: Function) => {
      callback({
        docs: [],
      });
      return jest.fn(); // Return unsubscribe function
    });

    const { result } = renderHook(() =>
      useTypingStatus(mockConversationId, mockCurrentUserId)
    );

    expect(result.current.typingText).toBe('');
  });

  it('should format correctly for 1 user typing', () => {
    const { onSnapshot } = require('firebase/firestore');
    
    onSnapshot.mockImplementation((ref: any, callback: Function) => {
      callback({
        docs: [
          {
            id: 'user456',
            data: () => ({ isTyping: true, displayName: 'Alice' }),
          },
        ],
      });
      return jest.fn();
    });

    const { result } = renderHook(() =>
      useTypingStatus(mockConversationId, mockCurrentUserId)
    );

    expect(result.current.typingText).toBe('Alice is typing...');
  });

  it('should format correctly for 2 users typing', () => {
    const { onSnapshot } = require('firebase/firestore');
    
    onSnapshot.mockImplementation((ref: any, callback: Function) => {
      callback({
        docs: [
          {
            id: 'user456',
            data: () => ({ isTyping: true, displayName: 'Alice' }),
          },
          {
            id: 'user789',
            data: () => ({ isTyping: true, displayName: 'Bob' }),
          },
        ],
      });
      return jest.fn();
    });

    const { result } = renderHook(() =>
      useTypingStatus(mockConversationId, mockCurrentUserId)
    );

    expect(result.current.typingText).toBe('Alice and Bob are typing...');
  });

  it('should format correctly for 3+ users typing', () => {
    const { onSnapshot } = require('firebase/firestore');
    
    onSnapshot.mockImplementation((ref: any, callback: Function) => {
      callback({
        docs: [
          {
            id: 'user456',
            data: () => ({ isTyping: true, displayName: 'Alice' }),
          },
          {
            id: 'user789',
            data: () => ({ isTyping: true, displayName: 'Bob' }),
          },
          {
            id: 'user101',
            data: () => ({ isTyping: true, displayName: 'Charlie' }),
          },
        ],
      });
      return jest.fn();
    });

    const { result } = renderHook(() =>
      useTypingStatus(mockConversationId, mockCurrentUserId)
    );

    expect(result.current.typingText).toBe('Alice, Bob, and 1 other are typing...');
  });
});

