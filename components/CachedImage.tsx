import React, { useState, memo } from 'react';
import { View, Image, ActivityIndicator, StyleSheet, Text, TouchableOpacity, Pressable } from 'react-native';

interface CachedImageProps {
  uri: string;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
}

const CachedImage = memo(({ uri, style, resizeMode = 'cover', onPress, onLongPress, delayLongPress = 500 }: CachedImageProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const cacheBustingUri = retryCount > 0
    ? `${uri}${uri.includes('?') ? '&' : '?'}retry=${retryCount}`
    : uri;

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  const handleRetry = () => {
    setLoading(true);
    setError(false);
    setRetryCount(prev => prev + 1);
  };

  const content = (
    <View style={[styles.container, style]}>
      {/* Placeholder during loading */}
      {loading && (
        <View style={[styles.placeholder, StyleSheet.absoluteFill]}>
          <ActivityIndicator color="#007AFF" />
        </View>
      )}

      {/* Error state */}
      {error && (
        <View style={[styles.errorContainer, StyleSheet.absoluteFill]}>
          <Text style={styles.errorText}>Unable to load image</Text>
          {retryCount < 3 && (
            <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Actual image - no animation to prevent re-render flicker */}
      {!error && (
        <Image
          key={cacheBustingUri}
          source={{ uri: cacheBustingUri }}
          style={style}
          resizeMode={resizeMode}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <PressableWrapper
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
      >
        {content}
      </PressableWrapper>
    );
  }

  return content;
}, (prevProps, nextProps) => {
  // Only re-render if URI or handlers changed
  return (
    prevProps.uri === nextProps.uri &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onLongPress === nextProps.onLongPress
  );
});

export default CachedImage;

const PressableWrapper = ({ onPress, onLongPress, delayLongPress, children }: {
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  children: React.ReactNode;
}) => {
  const Touchable = onPress || onLongPress ? TouchableOpacity : View;

  if (Touchable === View) {
    return <View>{children}</View>;
  }

  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      activeOpacity={0.9}
    >
      {children}
    </Touchable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', // Ensure content doesn't overflow during load
  },
  placeholder: {
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

