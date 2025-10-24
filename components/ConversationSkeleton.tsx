import { View, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';

export default function ConversationSkeleton({ count = 5 }: { count?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  
  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);
  
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <Animated.View key={index} style={[styles.row, { opacity }]}>
          {/* Avatar */}
          <View style={styles.avatar} />
          
          {/* Content */}
          <View style={styles.content}>
            <View style={styles.nameLine} />
            <View style={styles.messageLine} />
          </View>
          
          {/* Timestamp */}
          <View style={styles.timestamp} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8E8E8',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  nameLine: {
    width: '60%',
    height: 16,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    marginBottom: 8,
  },
  messageLine: {
    width: '90%',
    height: 14,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
  },
  timestamp: {
    width: 50,
    height: 12,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
  },
});

