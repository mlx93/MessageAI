import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ActivityIndicator} from 'react-native';
import {ProactiveSuggestion} from '../../services/aiService';
import {Ionicons} from '@expo/vector-icons';

interface ProactiveSuggestionCardProps {
  suggestion: ProactiveSuggestion;
  onAccept: (suggestionId: string, action?: string) => void;
  onDismiss: (suggestionId: string) => void;
  loading?: boolean;
}

export default function ProactiveSuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  loading,
}: ProactiveSuggestionCardProps) {
  const getIcon = () => {
    switch (suggestion.type) {
      case 'meeting':
        return '📅';
      case 'reminder':
        return '⏰';
      case 'context':
        return '💡';
      default:
        return '🤖';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{getIcon()}</Text>
          <Text style={styles.title}>Ava suggests</Text>
        </View>
        <TouchableOpacity
          onPress={() => onDismiss(suggestion.id)}
          disabled={loading}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <Text style={styles.message}>{suggestion.message}</Text>

      {suggestion.actions && suggestion.actions.length > 0 && (
        <View style={styles.actionsContainer}>
          {suggestion.actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.actionButton,
                index === 0 && styles.primaryButton,
              ]}
              onPress={() => onAccept(suggestion.id, action.action)}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text
                  style={[
                    styles.actionText,
                    index === 0 && styles.primaryText,
                  ]}>
                  {action.label}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 18,
    marginRight: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  message: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFF',
    minWidth: 100,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  primaryText: {
    color: '#FFF',
  },
});

