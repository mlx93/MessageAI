import React from 'react';
import { Pressable, ViewStyle, StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface AnimatedButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  hapticStyle?: 'light' | 'medium' | 'heavy';
}

/**
 * AnimatedButton - Reusable button component with scale animation and haptic feedback
 * 
 * Features:
 * - Scales to 95% on press with spring physics
 * - Haptic feedback on press (configurable intensity)
 * - Smooth spring animation on release
 * - Disabled state support
 * 
 * Usage:
 * <AnimatedButton onPress={handleSend} style={styles.sendButton}>
 *   <Text style={styles.sendButtonText}>Send</Text>
 * </AnimatedButton>
 */
export default function AnimatedButton({ 
  onPress, 
  children, 
  style, 
  disabled = false,
  hapticStyle = 'light'
}: AnimatedButtonProps) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handlePressIn = () => {
    if (disabled) return;
    
    // Scale down animation
    scale.value = withSpring(0.95, { 
      damping: 15,
      stiffness: 400,
    });
    
    // Haptic feedback
    const hapticType = 
      hapticStyle === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy :
      hapticStyle === 'medium' ? Haptics.ImpactFeedbackStyle.Medium :
      Haptics.ImpactFeedbackStyle.Light;
    
    Haptics.impactAsync(hapticType);
  };

  const handlePressOut = () => {
    if (disabled) return;
    
    // Scale back to normal
    scale.value = withSpring(1, { 
      damping: 10,
      stiffness: 300,
    });
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View style={[style, animatedStyle, disabled && { opacity: 0.5 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

