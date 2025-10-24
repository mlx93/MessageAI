import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface PriorityBadgeProps {
  priority: 'urgent' | 'important' | 'normal';
  confidence?: number;
}

export default function PriorityBadge({priority, confidence}: PriorityBadgeProps) {
  if (priority === 'normal') return null;

  const getBadgeStyle = () => {
    switch (priority) {
      case 'urgent':
        return {
          icon: '🔴',
          color: '#FF3B30',
          label: 'Urgent',
        };
      case 'important':
        return {
          icon: '🟡',
          color: '#FF9500',
          label: 'Important',
        };
      default:
        return null;
    }
  };

  const badge = getBadgeStyle();
  if (!badge) return null;

  return (
    <View style={[styles.container, {borderColor: badge.color}]}>
      <Text style={styles.icon}>{badge.icon}</Text>
      <Text style={[styles.label, {color: badge.color}]}>{badge.label}</Text>
      {confidence && confidence < 0.8 && (
        <Text style={styles.confidence}>?</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 4,
  },
  icon: {
    fontSize: 10,
    marginRight: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  confidence: {
    fontSize: 8,
    marginLeft: 2,
    color: '#999',
  },
});

