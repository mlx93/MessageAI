/**
 * In-App Notification Banner
 * 
 * Displays slide-down banner notification when message arrives in non-active conversation
 * Similar to iOS/WhatsApp in-app notifications
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';

interface NotificationData {
  id: string;
  conversationId: string;
  senderName: string;
  messageText: string;
  senderInitials: string;
  timestamp: number;
}

interface InAppNotificationBannerProps {
  notification: NotificationData | null;
  onDismiss: () => void;
}

export default function InAppNotificationBanner({ notification, onDismiss }: InAppNotificationBannerProps) {
  const translateY = useSharedValue(-200);
  const opacity = useSharedValue(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      // Show notification
      setVisible(true);
      translateY.value = withSpring(0, { damping: 15, stiffness: 100 });
      opacity.value = withTiming(1, { duration: 200 });

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      // Hide notification
      handleDismiss();
    }
  }, [notification]);

  const handleDismiss = () => {
    translateY.value = withTiming(-200, { duration: 300 });
    opacity.value = withTiming(0, { duration: 300 });
    
    setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 300);
  };

  const handlePress = () => {
    if (notification) {
      handleDismiss();
      // Navigate to conversation after animation completes
      // Use router.replace to avoid nesting - always go through Messages page
      setTimeout(() => {
        // First navigate to Messages tab, then to the conversation
        // This ensures back button always goes to Messages, not the previous conversation
        router.replace('/(tabs)');
        setTimeout(() => {
          router.push(`/chat/${notification.conversationId}`);
        }, 100);
      }, 350);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible || !notification) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <TouchableOpacity 
        style={styles.banner}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.content}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{notification.senderInitials}</Text>
          </View>
          
          <View style={styles.textContainer}>
            <Text style={styles.senderName} numberOfLines={1}>
              {notification.senderName}
            </Text>
            <Text style={styles.messageText} numberOfLines={2}>
              {notification.messageText}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.dismissButton}
          onPress={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
        >
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 50, // Safe area for status bar
    paddingHorizontal: 10,
  },
  banner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  textContainer: {
    flex: 1,
  },
  senderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    color: '#666',
  },
  dismissButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  dismissText: {
    fontSize: 20,
    color: '#999',
    fontWeight: '300',
  },
});

