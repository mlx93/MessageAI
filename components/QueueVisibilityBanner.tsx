/**
 * Queue Visibility Banner
 * 
 * Displays a banner at the bottom of chat screen showing pending/failed messages
 * Allows users to see queue status and scroll to first queued message
 */

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { getQueuedMessagesForConversation } from '../services/offlineQueue';

interface QueueVisibilityBannerProps {
  conversationId: string;
  onTapBanner: () => void; // Callback to scroll to first queued message
}

export default function QueueVisibilityBanner({ conversationId, onTapBanner }: QueueVisibilityBannerProps) {
  const [queueCount, setQueueCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Poll queue every 2 seconds
    const interval = setInterval(async () => {
      const queuedMessages = await getQueuedMessagesForConversation(conversationId);
      setQueueCount(queuedMessages.length);
      
      // Reappear if queue grows after dismissal
      if (queuedMessages.length > 0) {
        setDismissed(false);
      }
    }, 2000);

    // Check immediately on mount
    getQueuedMessagesForConversation(conversationId).then(messages => {
      setQueueCount(messages.length);
    });

    return () => clearInterval(interval);
  }, [conversationId]);

  if (queueCount === 0 || dismissed) {
    return null;
  }

  return (
    <Animated.View 
      entering={FadeInUp.duration(200)}
      exiting={FadeOutDown.duration(200)}
      style={styles.container}
    >
      <TouchableOpacity 
        style={styles.content}
        onPress={onTapBanner}
        activeOpacity={0.7}
      >
        <ActivityIndicator size="small" color="#856404" style={styles.spinner} />
        <Text style={styles.text}>
          {queueCount} message{queueCount === 1 ? '' : 's'} waiting to send
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        onPress={() => setDismissed(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.closeButton}
      >
        <Ionicons name="close" size={18} color="#856404" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF3CD',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#FFEAA7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  spinner: {
    marginRight: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: '#856404',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});

