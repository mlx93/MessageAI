import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

interface MessageActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDelete?: () => void;
  messageText: string;
  isOwnMessage: boolean;
}

export default function MessageActionSheet({
  visible,
  onClose,
  onCopy,
  onDelete,
  messageText,
  isOwnMessage,
}: MessageActionSheetProps) {
  const handleCopy = () => {
    onCopy();
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
      </Pressable>

      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(150)}
        style={styles.actionSheetContainer}
      >
        <View style={styles.actionSheet}>
          {/* Copy Action */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCopy}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>Copy</Text>
          </TouchableOpacity>

          {/* Divider */}
          {isOwnMessage && onDelete && <View style={styles.divider} />}

          {/* Delete Action - only for own messages */}
          {isOwnMessage && onDelete && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
            </TouchableOpacity>
          )}

          {/* Divider before Cancel */}
          <View style={styles.dividerThick} />

          {/* Cancel */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionText, styles.cancelText]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  actionSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 40,
  },
  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '400',
  },
  deleteText: {
    color: '#FF3B30',
  },
  cancelText: {
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
  },
  dividerThick: {
    height: 8,
    backgroundColor: '#F2F2F7',
  },
});
