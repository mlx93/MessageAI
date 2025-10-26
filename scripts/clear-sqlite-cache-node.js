#!/usr/bin/env node
/**
 * Clear SQLite Cache - Utility Script
 * 
 * Purpose: Clear all cached messages from SQLite database
 * Use when: Testing deletion fixes, database corruption, or stale data issues
 * 
 * Usage: node scripts/clear-sqlite-cache-node.js
 */

const fs = require('fs');
const path = require('path');

const clearCache = () => {
  try {
    // expo-sqlite stores the database in the device's document directory
    // For iOS Simulator, it's typically in:
    // ~/Library/Developer/CoreSimulator/Devices/[DEVICE_ID]/data/Containers/Data/Application/[APP_ID]/Library/LocalDatabase/
    
    // For development, we can find the most recent expo data directory
    const homeDir = require('os').homedir();
    const expoDataPath = path.join(homeDir, 'Library', 'Developer', 'CoreSimulator', 'Devices');
    
    console.log('🗄️  Looking for SQLite database...');
    console.log('');
    console.log('⚠️  IMPORTANT: This script needs to be run differently for React Native apps.');
    console.log('');
    console.log('🔧 Alternative methods to clear the cache:');
    console.log('');
    console.log('Method 1: Delete and reinstall the app (iOS Simulator)');
    console.log('  - Open iOS Simulator');
    console.log('  - Long press the app icon');
    console.log('  - Click "Delete App"');
    console.log('  - Run: npx expo start');
    console.log('  - Press "i" to reinstall on iOS');
    console.log('');
    console.log('Method 2: Clear app data (Android Emulator)');
    console.log('  - Open Settings > Apps > MessageAI');
    console.log('  - Click "Storage"');
    console.log('  - Click "Clear Data"');
    console.log('');
    console.log('Method 3: Add in-app cache clearing (recommended for testing)');
    console.log('  - Add a button in Settings that calls: await db.runAsync("DELETE FROM messages")');
    console.log('');
    console.log('Method 4: Use Expo dev menu');
    console.log('  - Shake device or press Cmd+D (iOS) / Cmd+M (Android)');
    console.log('  - Select "Clear cache" if available');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

clearCache();

