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
          deletedBy TEXT,
          priority TEXT,
          priorityConfidence REAL,
          priorityReason TEXT
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
      
      // Migration: Add priority columns if they don't exist
      try {
        db.execSync(`ALTER TABLE messages ADD COLUMN priority TEXT DEFAULT 'normal'`);
        console.log('✅ Added priority column to messages table');
      } catch (error: any) {
        if (!error.message?.includes('duplicate column')) {
          console.warn('Migration warning:', error);
        }
      }
      try {
        db.execSync(`ALTER TABLE messages ADD COLUMN priorityConfidence REAL`);
        console.log('✅ Added priorityConfidence column to messages table');
      } catch (error: any) {
        if (!error.message?.includes('duplicate column')) {
          console.warn('Migration warning:', error);
        }
      }
      try {
        db.execSync(`ALTER TABLE messages ADD COLUMN priorityReason TEXT`);
        console.log('✅ Added priorityReason column to messages table');
      } catch (error: any) {
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
 * CRITICAL: Never downgrades deletedBy - preserves user's deletion state
 */
export const cacheMessage = (message: Message): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // CRITICAL FIX: Check if message already exists with deletedBy data
      // Never overwrite a deletion with an older version from Firestore
      const existing = db.getFirstSync(
        'SELECT deletedBy FROM messages WHERE id = ?',
        [message.id]
      ) as { deletedBy: string } | undefined;
      
      let finalDeletedBy = message.deletedBy || [];
      
      if (existing && existing.deletedBy) {
        try {
          const existingDeletedBy = JSON.parse(existing.deletedBy) as string[];
          // Merge deletedBy arrays - keep all deletions (union)
          const mergedSet = new Set([...existingDeletedBy, ...finalDeletedBy]);
          finalDeletedBy = Array.from(mergedSet);
        } catch (e) {
          // If parsing fails, use incoming deletedBy
          console.warn('Failed to parse existing deletedBy, using incoming:', e);
        }
      }
      
      db.runSync(
        'INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
          JSON.stringify(finalDeletedBy),
          message.priority || 'normal',
          message.priorityConfidence || null,
          message.priorityReason || null
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
      
      // CRITICAL: Use cacheMessage() for each message to ensure merge logic is applied
      // This prevents Firestore listener from overwriting deletions with stale data
      try {
        // Use Promise.all to batch the writes while maintaining merge logic
        await Promise.all(batch.map(msg => cacheMessage(msg)));
      } catch (error) {
        console.error('Batched SQLite write failed:', error);
      }
    }
  }, 500);
};

/**
 * Flush cache buffer immediately (e.g., on app close)
 * CRITICAL: Awaits all writes to ensure persistence before navigation/exit
 */
export const flushCacheBuffer = async () => {
  if (writeTimer) clearTimeout(writeTimer);
  if (writeBuffer.size > 0) {
    const batch = Array.from(writeBuffer.values());
    writeBuffer.clear();
    // CRITICAL: Await all writes to ensure completion
    // This ensures deletedBy updates persist before navigation
    await Promise.all(batch.map(msg => cacheMessage(msg)));
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
        deletedBy: row.deletedBy ? JSON.parse(row.deletedBy) : [],
        priority: row.priority || 'normal',
        priorityConfidence: row.priorityConfidence || undefined,
        priorityReason: row.priorityReason || undefined
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
 * Optimized for faster initial load
 * 
 * @param conversationId - The conversation ID to fetch messages for
 * @param limit - Maximum number of messages to return
 * @param userId - Optional user ID to filter out deleted messages for this user
 */
export const getCachedMessagesPaginated = (
  conversationId: string, 
  limit: number = 30,
  userId?: string
): Promise<Message[]> => {
  return new Promise((resolve) => {
    try {
      // Fetch MORE messages than limit to account for deleted ones
      // This ensures we get enough non-deleted messages for proper list mode determination
      const fetchLimit = userId ? limit * 3 : limit;
      
      const result = db.getAllSync(
        'SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp DESC LIMIT ?',
        [conversationId, fetchLimit]
      );
      
      const allMessages = result.map((row: any) => ({
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
        deletedBy: row.deletedBy ? JSON.parse(row.deletedBy) : [],
        priority: row.priority || 'normal',
        priorityConfidence: row.priorityConfidence || undefined,
        priorityReason: row.priorityReason || undefined
      })) as Message[];
      
      // Filter out messages deleted by this user (if userId provided)
      const messages = userId 
        ? allMessages.filter(msg => !msg.deletedBy || !msg.deletedBy.includes(userId))
        : allMessages;
      
      // Take only the requested limit after filtering
      const limitedMessages = messages.slice(0, limit);
      
      // Log diagnostic info to help understand cache state
      if (userId && allMessages.length !== messages.length) {
        const deletedCount = allMessages.length - messages.length;
        console.log(`📦 Cache: Found ${allMessages.length} total messages, ${deletedCount} deleted, returning ${limitedMessages.length} visible`);
      }
      
      // Reverse to get chronological order (oldest first)
      resolve(limitedMessages.reverse());
    } catch (error) {
      console.warn('getCachedMessagesPaginated failed:', error);
      // Return empty array instead of rejecting to prevent crashes
      resolve([]);
    }
  });
};

/**
 * Get the total count of non-deleted messages in a conversation
 * Used to determine if there are older messages available
 */
export const getCachedMessageCount = (
  conversationId: string,
  userId?: string
): Promise<number> => {
  return new Promise((resolve) => {
    try {
      const result = db.getAllSync(
        'SELECT COUNT(*) as count FROM messages WHERE conversationId = ?',
        [conversationId]
      ) as Array<{ count: number }>;
      
      if (!userId) {
        const count = result[0]?.count || 0;
        resolve(count);
        return;
      }
      
      // If userId provided, we need to count non-deleted messages
      // SQLite doesn't have good JSON filtering, so fetch all and filter
      const allRows = db.getAllSync(
        'SELECT deletedBy FROM messages WHERE conversationId = ?',
        [conversationId]
      ) as Array<{ deletedBy: string | null }>;
      
      let nonDeletedCount = 0;
      for (const row of allRows) {
        const deletedBy = row.deletedBy ? JSON.parse(row.deletedBy) : [];
        if (!deletedBy.includes(userId)) {
          nonDeletedCount++;
        }
      }
      
      resolve(nonDeletedCount);
    } catch (error) {
      console.warn('getCachedMessageCount failed:', error);
      resolve(0);
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
        deletedBy: row.deletedBy ? JSON.parse(row.deletedBy) : [],
        priority: row.priority || 'normal',
        priorityConfidence: row.priorityConfidence || undefined,
        priorityReason: row.priorityReason || undefined
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

