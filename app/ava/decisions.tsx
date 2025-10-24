import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import aiService, {Decision} from '../../services/aiService';
import {format} from 'date-fns';

export default function DecisionsScreen() {
  const [decisions, setDecisions] = useState<(Decision & {id: string})[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = aiService.getAllDecisions().onSnapshot((snapshot: any) => {
      const items = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDecisions(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const renderItem = ({item}: {item: Decision & {id: string}}) => (
    <View style={styles.decisionCard}>
      <View style={styles.decisionHeader}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>📌</Text>
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.decisionText}>{item.decision}</Text>
          <Text style={styles.dateText}>
            {format(item.madeAt, 'MMM d, yyyy')}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💭 Rationale</Text>
        <Text style={styles.sectionText}>{item.rationale}</Text>
      </View>

      {item.alternativesConsidered.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Alternatives Considered</Text>
          {item.alternativesConsidered.map((alt, index) => (
            <Text key={index} style={styles.bulletText}>
              • {alt}
            </Text>
          ))}
        </View>
      )}

      {item.participants.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👥 Participants</Text>
          <View style={styles.participants}>
            {item.participants.map((participant, index) => (
              <View key={index} style={styles.participantChip}>
                <Text style={styles.participantText}>{participant}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.confidenceText}>
          {Math.round(item.confidence * 100)}% confident
        </Text>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => router.push(`/chat/${item.conversationId}`)}>
          <Text style={styles.viewButtonText}>View context</Text>
          <Ionicons name="arrow-forward" size={16} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Decisions</Text>
        <View style={{width: 24}} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading decisions...</Text>
        </View>
      ) : decisions.length > 0 ? (
        <FlatList
          data={decisions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                📌 {decisions.length} decision{decisions.length !== 1 ? 's' : ''}{' '}
                tracked
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyText}>No decisions yet</Text>
          <Text style={styles.emptySubtext}>
            Team decisions will appear here as Ava detects them
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  list: {
    padding: 16,
    gap: 16,
  },
  summary: {
    backgroundColor: '#F0F8FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#007AFF40',
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  decisionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  decisionHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  headerContent: {
    flex: 1,
  },
  decisionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    lineHeight: 24,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    color: '#999',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  bulletText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    paddingLeft: 8,
  },
  participants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantChip: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  participantText: {
    fontSize: 13,
    color: '#333',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  confidenceText: {
    fontSize: 12,
    color: '#999',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

