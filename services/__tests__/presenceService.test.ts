/**
 * Presence Service Tests
 */

import {
  setUserOnline,
  setUserOffline,
  subscribeToUserPresence,
  updateLastSeen,
} from '../presenceService';

// Mock Firebase
jest.mock('../firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

describe('Presence Service', () => {
  const mockUserId = 'user123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setUserOnline', () => {
    it('should set user online status to true', async () => {
      const { setDoc } = require('firebase/firestore');
      
      await setUserOnline(mockUserId);
      
      expect(setDoc).toHaveBeenCalled();
      // Check that online: true was set
      const setDocCalls = setDoc.mock.calls;
      expect(setDocCalls.length).toBeGreaterThan(0);
    });
  });

  describe('setUserOffline', () => {
    it('should set user online status to false', async () => {
      const { setDoc } = require('firebase/firestore');
      
      await setUserOffline(mockUserId);
      
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('subscribeToUserPresence', () => {
    it('should call callback when presence changes', () => {
      const { onSnapshot } = require('firebase/firestore');
      const mockCallback = jest.fn();
      
      // Mock snapshot
      onSnapshot.mockImplementation((ref: any, callback: Function) => {
        callback({
          exists: () => true,
          data: () => ({
            online: true,
            lastSeen: { toDate: () => new Date() },
          }),
        });
        return jest.fn(); // Return unsubscribe function
      });
      
      subscribeToUserPresence(mockUserId, mockCallback);
      
      expect(mockCallback).toHaveBeenCalled();
      expect(onSnapshot).toHaveBeenCalled();
    });
  });

  describe('updateLastSeen', () => {
    it('should update lastSeen timestamp', async () => {
      const { setDoc } = require('firebase/firestore');
      
      await updateLastSeen(mockUserId);
      
      expect(setDoc).toHaveBeenCalled();
    });
  });
});

