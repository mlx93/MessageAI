import React, {useState} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';

interface AvaAnswerCardProps {
  question: string;
  answer: string;
  loading?: boolean;
  conversationId?: string;
  onDismiss: () => void;
}

export default function AvaAnswerCard({
  question,
  answer,
  loading = false,
  conversationId,
  onDismiss,
}: AvaAnswerCardProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  const handleViewFull = () => {
    router.push({
      pathname: '/ava/chat',
      params: {
        query: question,
        conversationId,
      },
    });
  };

  if (dismissed) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={20} color="#10b981" />
          <Text style={styles.headerText}>Ava's Answer</Text>
        </View>
        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        >
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Question */}
      <View style={styles.questionContainer}>
        <Ionicons name="help-circle-outline" size={16} color="#666" style={styles.questionIcon} />
        <Text style={styles.question} numberOfLines={2}>
          {question}
        </Text>
      </View>

      {/* Answer or Loading */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#10b981" />
          <Text style={styles.loadingText}>Searching conversation history...</Text>
        </View>
      ) : (
        <>
          {/* Answer Preview */}
          <Text style={styles.answer} numberOfLines={4}>
            {answer}
          </Text>

          {/* View Full Button */}
          <TouchableOpacity
            style={styles.viewFullButton}
            onPress={handleViewFull}
            activeOpacity={0.7}
          >
            <Text style={styles.viewFullText}>View Full Answer in Ava</Text>
            <Ionicons name="arrow-forward" size={16} color="#10b981" />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0fdf4', // Light green background
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#86efac',
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
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065f46',
  },
  questionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#dcfce7',
    borderRadius: 8,
  },
  questionIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  question: {
    flex: 1,
    fontSize: 14,
    color: '#065f46',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#059669',
    fontStyle: 'italic',
  },
  answer: {
    fontSize: 15,
    lineHeight: 22,
    color: '#065f46',
    marginBottom: 12,
  },
  viewFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  viewFullText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
});

