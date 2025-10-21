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
          deliveredTo TEXT
        )`
      );
      
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
        'INSERT OR REPLACE INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
          JSON.stringify(message.deliveredTo)
        ]
      );
      resolve();
    } catch (error) {
      reject(error);
    }
  });
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
        deliveredTo: JSON.parse(row.deliveredTo)
      })) as Message[];
      
      resolve(messages);
    } catch (error) {
      reject(error);
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

