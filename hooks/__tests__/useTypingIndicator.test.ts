/**
 * Typing Indicator Hooks Tests
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useTypingIndicator, useTypingStatus } from '../useTypingIndicator';

// Mock Firebase
jest.mock('../services/firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  collection: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

describe('useTypingIndicator', () => {
  const mockConversationId = 'conv123';
  const mockUserId = 'user123';
  const mockDisplayName = 'John Doe';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should set typing status to true when startTyping is called', async () => {
    const { setDoc } = require('firebase/firestore');
    
    const { result } = renderHook(() =>
      useTypingIndicator(mockConversationId, mockUserId, mockDisplayName)
    );

    await act(async () => {
      result.current.startTyping();
    });

    expect(setDoc).toHaveBeenCalled();
  });

  it('should clear typing status after 500ms', async () => {
    const { setDoc } = require('firebase/firestore');
    
    const { result } = renderHook(() =>
      useTypingIndicator(mockConversationId, mockUserId, mockDisplayName)
    );

    await act(async () => {
      result.current.startTyping();
      jest.advanceTimersByTime(500);
    });

    // Should be called twice: once to set typing, once to clear
    expect(setDoc).toHaveBeenCalledTimes(2);
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

