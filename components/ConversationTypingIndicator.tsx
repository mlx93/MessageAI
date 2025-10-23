import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

interface Props {
  typingUserNames: string[];  // Array of display names of users typing
}

export default function ConversationTypingIndicator({ typingUserNames }: Props) {
  const opacity1 = useSharedValue(0.3);
  const opacity2 = useSharedValue(0.3);
  const opacity3 = useSharedValue(0.3);

  useEffect(() => {
    // Staggered animation for 3 dots
    opacity1.value = withRepeat(
      withTiming(1, { duration: 600 }),
      -1,
      true
    );
    setTimeout(() => {
      opacity2.value = withRepeat(
        withTiming(1, { duration: 600 }),
        -1,
        true
      );
    }, 200);
    setTimeout(() => {
      opacity3.value = withRepeat(
        withTiming(1, { duration: 600 }),
        -1,
        true
      );
    }, 400);
  }, []);

  const dot1Style = useAnimatedStyle(() => ({ opacity: opacity1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: opacity2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: opacity3.value }));

  // Format typing text
  const typingText = typingUserNames.length === 1 
    ? `${typingUserNames[0]} is typing`
    : typingUserNames.length === 2
    ? `${typingUserNames[0]} and ${typingUserNames[1]} are typing`
    : `${typingUserNames.length} people are typing`;

  return (
    <View style={styles.container}>
      <Text style={styles.typingText}>{typingText}</Text>
      <View style={styles.dotsContainer}>
        <Animated.View style={[styles.dot, dot1Style]} />
        <Animated.View style={[styles.dot, dot2Style]} />
        <Animated.View style={[styles.dot, dot3Style]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    fontSize: 14,
    color: '#8E8E93',
    marginRight: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8E8E93',
  },
});

