import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ActivityIndicator} from 'react-native';
import {
  ProactiveSuggestion,
  ProactiveSuggestionPriority,
  ProactiveSuggestionType,
} from '../../services/aiService';
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
  const getVisuals = (
    type: ProactiveSuggestionType,
    priority?: ProactiveSuggestionPriority,
  ) => {
    switch (type) {
      case 'meeting':
        return {icon: '📅', title: 'Meeting Aid', accent: '#007AFF'};
      case 'reminder':
        return {icon: '⏰', title: 'Reminder', accent: '#FF9500'};
      case 'context':
        return {icon: '💡', title: 'Context Helper', accent: '#5856D6'};
      case 'deadline_conflict':
        return {icon: '🗓️', title: 'Deadline Conflict', accent: '#FF3B30'};
      case 'decision_conflict':
        return {icon: '⚖️', title: 'Decision Conflict', accent: '#AF52DE'};
      case 'overdue_action':
        return {icon: '📌', title: 'Overdue Action', accent: '#FF2D55'};
      case 'context_gap':
        return {icon: '🧭', title: 'Context Gap', accent: '#34C759'};
      case 'escalation':
        return {icon: '🚨', title: 'Escalation Needed', accent: '#FF3B30'};
      default:
        return {icon: '🤖', title: 'Ava Suggests', accent: '#007AFF'};
    }
  };

  const {icon, title, accent} = getVisuals(
    suggestion.type,
    suggestion.priority,
  );

  const getPriorityLabel = (priority?: ProactiveSuggestionPriority) => {
    switch (priority) {
      case 'high':
        return 'High Priority';
      case 'medium':
        return 'Medium Priority';
      case 'low':
        return 'Low Priority';
      default:
        return null;
    }
  };

  const priorityLabel = getPriorityLabel(suggestion.priority);

  return (
    <View style={[styles.container, {borderLeftColor: accent}]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.title, {color: accent}]}>{title}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onDismiss(suggestion.id)}
          disabled={loading}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="close" size={20} color={accent} />
        </TouchableOpacity>
      </View>

      <Text style={styles.message}>{suggestion.message}</Text>

      {priorityLabel && (
        <View style={[styles.priorityPill, {borderColor: accent}]}>
          <Text style={[styles.priorityText, {color: accent}]}>
            {priorityLabel}
          </Text>
          {typeof suggestion.confidence === 'number' && (
            <Text style={[styles.confidenceText, {color: accent}]}>
              {(suggestion.confidence * 100).toFixed(0)}%
            </Text>
          )}
        </View>
      )}

      {suggestion.actions && suggestion.actions.length > 0 && (
        <View style={styles.actionsContainer}>
          {suggestion.actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.actionButton,
                {borderColor: accent},
                index === 0 && styles.primaryButton,
                index === 0 && {backgroundColor: accent, borderColor: accent},
              ]}
              onPress={() => onAccept(suggestion.id, action.action)}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={accent} />
              ) : (
                <Text
                  style={[
                    styles.actionText,
                    {color: accent},
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
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
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
    backgroundColor: '#FFF',
    minWidth: 100,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFF',
  },
});

