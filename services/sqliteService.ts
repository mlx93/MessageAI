import * as SQLite from 'expo-sqlite';
import { Message, Conversation } from '../types';

const db = SQLite.openDatabaseSync('messages.db');

/**
 * Initialize the SQLite database with tables
 */
export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Messages table
      db.execSync(
        `CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversationId TEXT,
          text TEXT,
          senderId TEXT,
          timestamp INTEGER,
          status TEXT,
          type TEXT,
          localId TEXT,
          mediaURL TEXT,
          readBy TEXT,
          deliveredTo TEXT,
          deletedBy TEXT
        )`
      );
      
      // Migration: Add deletedBy column if it doesn't exist (for existing databases)
      try {
        db.execSync(`ALTER TABLE messages ADD COLUMN deletedBy TEXT DEFAULT '[]'`);
        console.log('✅ Added deletedBy column to messages table');
      } catch (error: any) {
        // Column already exists (expected on new installations)
        if (!error.message?.includes('duplicate column')) {
          console.warn('Migration warning:', error);
        }
      }
      
      // Conversations table
      db.execSync(
        `CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          type TEXT,
          participants TEXT,
          lastMessage TEXT,
          participantDetails TEXT,
          createdAt INTEGER,
          updatedAt INTEGER
        )`
      );
      
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Cache a message to SQLite
 */
export const cacheMessage = (message: Message): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      db.runSync(
        'INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          message.id,
          message.conversationId,
          message.text,
          message.senderId,
          message.timestamp.getTime(),
          message.status,
          message.type,
          message.localId,
          message.mediaURL || null,
          JSON.stringify(message.readBy),
          JSON.stringify(message.deliveredTo),
          JSON.stringify(message.deletedBy || [])
        ]
      );
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Batched version of cacheMessage
 * Buffers messages and writes them in batches to reduce main thread blocking
 * 
 * Key optimization: Deduplicates messages to prevent caching the same message
 * multiple times when Firestore listener fires on read receipts/delivery status updates
 */
let writeBuffer: Map<string, Message> = new Map(); // Use Map to deduplicate by message ID
let writeTimer: NodeJS.Timeout | null = null;

export const cacheMessageBatched = (message: Message) => {
  // Deduplicate: Only keep the latest version of each message
  writeBuffer.set(message.id, message);
  
  // Clear existing timer
  if (writeTimer) clearTimeout(writeTimer);
  
  // Flush after 500ms of no new messages
  writeTimer = setTimeout(async () => {
    if (writeBuffer.size > 0) {
      const batch = Array.from(writeBuffer.values());
      writeBuffer.clear();
      
      // Write all at once (console logs removed to prevent re-renders)
      try {
        batch.forEach(msg => {
          db.runSync(
            'INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              msg.id,
              msg.conversationId,
              msg.text,
              msg.senderId,
              msg.timestamp.getTime(),
              msg.status,
              msg.type,
              msg.localId,
              msg.mediaURL || null,
              JSON.stringify(msg.readBy),
              JSON.stringify(msg.deliveredTo),
              JSON.stringify(msg.deletedBy || [])
            ]
          );
        });
      } catch (error) {
        console.error('Batched SQLite write failed:', error);
      }
    }
  }, 500);
};

/**
 * Flush cache buffer immediately (e.g., on app close)
 */
export const flushCacheBuffer = async () => {
  if (writeTimer) clearTimeout(writeTimer);
  if (writeBuffer.size > 0) {
    const batch = Array.from(writeBuffer.values());
    writeBuffer.clear();
    // Silent flush (no console log)
    batch.forEach(msg => cacheMessage(msg));
  }
};

/**
 * Get cached messages for a conversation
 */
export const getCachedMessages = (conversationId: string): Promise<Message[]> => {
  return new Promise((resolve, reject) => {
    try {
      const result = db.getAllSync(
        'SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC',
        [conversationId]
      );
      
      const messages = result.map((row: any) => ({
        id: row.id,
        conversationId: row.conversationId,
        text: row.text,
        senderId: row.senderId,
        timestamp: new Date(row.timestamp),
        status: row.status,
        type: row.type,
        localId: row.localId,
        mediaURL: row.mediaURL,
        readBy: JSON.parse(row.readBy),
        deliveredTo: JSON.parse(row.deliveredTo),
        deletedBy: row.deletedBy ? JSON.parse(row.deletedBy) : []
      })) as Message[];
      
      resolve(messages);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get cached messages with pagination support
 * Returns the most recent messages first (for instant display)
 */
export const getCachedMessagesPaginated = (
  conversationId: string, 
  limit: number = 30
): Promise<Message[]> => {
  return new Promise((resolve, reject) => {
    try {
      const result = db.getAllSync(
        'SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp DESC LIMIT ?',
        [conversationId, limit]
      );
      
      const messages = result.map((row: any) => ({
        id: row.id,
        conversationId: row.conversationId,
        text: row.text,
        senderId: row.senderId,
        timestamp: new Date(row.timestamp),
        status: row.status,
        type: row.type,
        localId: row.localId,
        mediaURL: row.mediaURL,
        readBy: JSON.parse(row.readBy),
        deliveredTo: JSON.parse(row.deliveredTo),
        deletedBy: row.deletedBy ? JSON.parse(row.deletedBy) : []
      })) as Message[];
      
      // Reverse to get chronological order (oldest first)
      resolve(messages.reverse());
    } catch (error) {
      console.warn('getCachedMessagesPaginated failed:', error);
      // Return empty array instead of rejecting to prevent crashes
      resolve([]);
    }
  });
};

/**
 * Get older cached messages before a specific timestamp
 * Used for upward pagination
 */
export const getCachedMessagesBefore = (
  conversationId: string,
  beforeTimestamp: Date,
  limit: number = 30
): Promise<Message[]> => {
  return new Promise((resolve, reject) => {
    try {
      const result = db.getAllSync(
        'SELECT * FROM messages WHERE conversationId = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT ?',
        [conversationId, beforeTimestamp.getTime(), limit]
      );
      
      const messages = result.map((row: any) => ({
        id: row.id,
        conversationId: row.conversationId,
        text: row.text,
        senderId: row.senderId,
        timestamp: new Date(row.timestamp),
        status: row.status,
        type: row.type,
        localId: row.localId,
        mediaURL: row.mediaURL,
        readBy: JSON.parse(row.readBy),
        deliveredTo: JSON.parse(row.deliveredTo),
        deletedBy: row.deletedBy ? JSON.parse(row.deletedBy) : []
      })) as Message[];
      
      // Reverse to get chronological order (oldest first)
      resolve(messages.reverse());
    } catch (error) {
      console.warn('getCachedMessagesBefore failed:', error);
      // Return empty array instead of rejecting to prevent crashes
      resolve([]);
    }
  });
};

/**
 * Cache a conversation to SQLite
 */
export const cacheConversation = (conversation: Conversation): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      db.runSync(
        'INSERT OR REPLACE INTO conversations VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          conversation.id,
          conversation.type,
          JSON.stringify(conversation.participants),
          JSON.stringify(conversation.lastMessage),
          JSON.stringify(conversation.participantDetails),
          conversation.createdAt.getTime(),
          conversation.updatedAt.getTime()
        ]
      );
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get all cached conversations
 */
export const getCachedConversations = (): Promise<Conversation[]> => {
  return new Promise((resolve, reject) => {
    try {
      const result = db.getAllSync(
        'SELECT * FROM conversations ORDER BY updatedAt DESC'
      );
      
      const conversations = result.map((row: any) => ({
        id: row.id,
        type: row.type,
        participants: JSON.parse(row.participants),
        lastMessage: JSON.parse(row.lastMessage),
        participantDetails: JSON.parse(row.participantDetails),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      })) as Conversation[];
      
      resolve(conversations);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Clear all cached data (useful for sign out)
 */
export const clearCache = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      db.runSync('DELETE FROM messages');
      db.runSync('DELETE FROM conversations');
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

