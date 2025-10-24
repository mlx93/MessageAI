import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import aiService, {ThreadSummary} from '../../services/aiService';

interface ThreadSummaryModalProps {
  visible: boolean;
  conversationId: string;
  onClose: () => void;
}

export default function ThreadSummaryModal({
  visible,
  conversationId,
  onClose,
}: ThreadSummaryModalProps) {
  const [summary, setSummary] = useState<ThreadSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRange, setSelectedRange] = useState<'day' | 'week' | 'all'>(
    'all'
  );

  const handleSummarize = async (range: 'day' | 'week' | 'all') => {
    setLoading(true);
    setSelectedRange(range);

    try {
      let dateRange;
      if (range === 'day') {
        const start = new Date();
        start.setDate(start.getDate() - 1);
        dateRange = {
          start: start.toISOString(),
          end: new Date().toISOString(),
        };
      } else if (range === 'week') {
        const start = new Date();
        start.setDate(start.getDate() - 7);
        dateRange = {
          start: start.toISOString(),
          end: new Date().toISOString(),
        };
      }

      const result = await aiService.summarizeThread(conversationId, dateRange);
      setSummary(result);
    } catch (error) {
      console.error('Error summarizing thread:', error);
      Alert.alert('Error', 'Failed to generate summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Thread Summary</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons name="close" size={28} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Range Selector */}
        <View style={styles.rangeSelector}>
          {[
            {key: 'day', label: 'Last 24h'},
            {key: 'week', label: 'Last Week'},
            {key: 'all', label: 'All Time'},
          ].map((range) => (
            <TouchableOpacity
              key={range.key}
              style={[
                styles.rangeButton,
                selectedRange === range.key && styles.rangeButtonActive,
              ]}
              onPress={() => handleSummarize(range.key as any)}
              disabled={loading}>
              <Text
                style={[
                  styles.rangeButtonText,
                  selectedRange === range.key && styles.rangeButtonTextActive,
                ]}>
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>
                Ava is analyzing the conversation...
              </Text>
            </View>
          ) : summary ? (
            <View>
              <View style={styles.metaInfo}>
                <Text style={styles.metaText}>
                  📊 {summary.messageCount} messages analyzed
                </Text>
              </View>
              <Text style={styles.summaryText}>{summary.summary}</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>
                Select a time range to generate a summary
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  rangeSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  rangeButtonActive: {
    backgroundColor: '#007AFF',
  },
  rangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  rangeButtonTextActive: {
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  metaInfo: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  metaText: {
    fontSize: 14,
    color: '#666',
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

