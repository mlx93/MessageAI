import React, { useState, useCallback } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, ImageStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface ProgressiveImageProps {
  source: { uri: string };
  style?: ImageStyle;
  placeholder?: React.ReactNode;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: () => void;
}

export default function ProgressiveImage({
  source,
  style,
  placeholder,
  onLoadStart,
  onLoadEnd,
  onError,
}: ProgressiveImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    onLoadStart?.();
  }, [onLoadStart]);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
    onLoadEnd?.();
  }, [onLoadEnd]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  return (
    <View style={[styles.container, style]}>
      {isLoading && (
        <Animated.View 
          style={styles.loadingContainer}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
        >
          {placeholder || (
            <ActivityIndicator size="small" color="#007AFF" />
          )}
        </Animated.View>
      )}
      
      <Image
        source={source}
        style={[styles.image, style, isLoading && styles.hiddenImage]}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        resizeMode="cover"
      />
      
      {hasError && (
        <Animated.View 
          style={styles.errorContainer}
          entering={FadeIn.duration(200)}
        >
          <View style={styles.errorPlaceholder}>
            {/* Error placeholder - could be an icon */}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  hiddenImage: {
    opacity: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  errorPlaceholder: {
    width: 24,
    height: 24,
    backgroundColor: '#CCCCCC',
    borderRadius: 4,
  },
});
