/**
 * Network Status Banner
 * 
 * Displays a persistent banner at the top of the app when offline
 * Uses @react-native-community/netinfo to monitor connectivity
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInDown, 
  FadeOutUp,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue
} from 'react-native-reanimated';

export default function NetworkStatusBanner() {
  const [isConnected, setIsConnected] = useState(true);
  const [showReconnecting, setShowReconnecting] = useState(false);
  const dotOpacity = useSharedValue(1);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? true;
      setIsConnected(connected);
      
      if (!connected) {
        setShowReconnecting(false);
        // Show "Trying to reconnect..." after 3 seconds of being offline
        const timer = setTimeout(() => {
          setShowReconnecting(true);
          // Start animated dots
          dotOpacity.value = withRepeat(
            withSequence(
              withTiming(0.3, { duration: 500 }),
              withTiming(1, { duration: 500 })
            ),
            -1, // infinite
            false
          );
        }, 3000);
        
        return () => clearTimeout(timer);
      } else {
        setShowReconnecting(false);
        dotOpacity.value = 1;
      }
    });

    return () => unsubscribe();
  }, []);

  const animatedDotsStyle = useAnimatedStyle(() => {
    return {
      opacity: dotOpacity.value,
    };
  });

  if (isConnected) {
    return null;
  }

  return (
    <Animated.View 
      entering={FadeInDown.duration(200)}
      exiting={FadeOutUp.duration(200)}
      style={styles.container}
    >
      <View style={styles.content}>
        <Ionicons name="wifi-outline" size={16} color="#666" style={styles.icon} />
        <View>
          <Text style={styles.mainText}>No Internet Connection</Text>
          {showReconnecting && (
            <Animated.Text style={[styles.subText, animatedDotsStyle]}>
              Trying to reconnect...
            </Animated.Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E8E8E8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D0D0D0',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  mainText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  subText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
  },
});

