/**
 * ImageViewer Component
 * 
 * Full-screen modal for viewing images with pinch-to-zoom
 * Features: Swipe to dismiss, zoom gestures, minimal UI
 */

import { useState } from 'react';
import { Modal, View, Image, StyleSheet, TouchableOpacity, StatusBar, Dimensions, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';

interface ImageViewerProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageViewer({ visible, imageUrl, onClose }: ImageViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  // Animation values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset when modal opens
  const handleModalShow = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    setIsLoading(true);
  };

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      // Limit zoom
      if (scale.value > 3) {
        scale.value = withSpring(3);
      } else if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
      savedScale.value = scale.value;
    });

  // Pan gesture for dragging
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd((event) => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;

      // Swipe down to close (only when not zoomed)
      if (scale.value === 1 && event.translationY > 100) {
        runOnJS(onClose)();
      } else if (scale.value === 1) {
        // Reset position if not closing
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Double tap to zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        // Zoom out
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      onShow={handleModalShow}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Close button */}
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <View style={styles.closeButtonBackground}>
            <Ionicons name="close" size={28} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* Image with gestures */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.imageContainer, animatedStyle]}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="contain"
              onLoadEnd={() => setIsLoading(false)}
            />
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFF" />
              </View>
            )}
          </Animated.View>
        </GestureDetector>

        {/* Instructions */}
        {!isLoading && (
          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              Pinch to zoom • Double tap to zoom • Swipe down to close
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeButtonBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructions: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#FFF',
    fontSize: 14,
    textAlign: 'center',
  },
});

