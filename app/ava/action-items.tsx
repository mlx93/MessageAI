import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import aiService, {ActionItem} from '../../services/aiService';
import {formatDistanceToNow} from 'date-fns';

export default function ActionItemsScreen() {
  const [actionItems, setActionItems] = useState<(ActionItem & {id: string})[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = aiService.getAllActionItems().onSnapshot((snapshot: any) => {
      const items = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setActionItems(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleComplete = async (itemId: string) => {
    Alert.alert(
      'Complete Action Item',
      'Mark this action item as completed?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            setCompleting(itemId);
            try {
              await aiService.completeActionItem(itemId);
            } catch (error) {
              console.error('Error completing action item:', error);
              Alert.alert('Error', 'Failed to complete action item');
            } finally {
              setCompleting(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({item}: {item: ActionItem & {id: string}}) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemTitleRow}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => handleComplete(item.id)}
            disabled={completing === item.id}>
            {completing === item.id ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="ellipse-outline" size={24} color="#007AFF" />
            )}
          </TouchableOpacity>
          <Text style={styles.itemTask}>{item.task}</Text>
        </View>
      </View>

      {item.context && (
        <Text style={styles.itemContext} numberOfLines={2}>
          {item.context}
        </Text>
      )}

      <View style={styles.itemFooter}>
        {item.assignee && (
          <View style={styles.tag}>
            <Ionicons name="person-outline" size={12} color="#666" />
            <Text style={styles.tagText}>{item.assignee}</Text>
          </View>
        )}
        {item.deadline && (
          <View style={[styles.tag, styles.deadlineTag]}>
            <Ionicons name="calendar-outline" size={12} color="#FF3B30" />
            <Text style={[styles.tagText, styles.deadlineText]}>
              {formatDistanceToNow(new Date(item.deadline), {addSuffix: true})}
            </Text>
          </View>
        )}
        <View style={styles.tag}>
          <Text style={styles.tagText}>
            {Math.round(item.confidence * 100)}% confident
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.viewConversation}
        onPress={() => router.push(`/chat/${item.conversationId}`)}>
        <Text style={styles.viewConversationText}>View in conversation</Text>
        <Ionicons name="arrow-forward" size={16} color="#007AFF" />
      </TouchableOpacity>
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
        <Text style={styles.title}>Action Items</Text>
        <View style={{width: 24}} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading action items...</Text>
        </View>
      ) : actionItems.length > 0 ? (
        <FlatList
          data={actionItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                ✅ {actionItems.length} pending action item
                {actionItems.length !== 1 ? 's' : ''}
              </Text>
            </View>
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✨</Text>
          <Text style={styles.emptyText}>All caught up!</Text>
          <Text style={styles.emptySubtext}>
            No pending action items at the moment
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
    gap: 12,
  },
  summary: {
    backgroundColor: '#FFF9E6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    marginTop: 2,
  },
  itemTask: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    lineHeight: 22,
  },
  itemContext: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
    paddingLeft: 36,
  },
  itemFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingLeft: 36,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
  },
  deadlineTag: {
    backgroundColor: '#FFF0F0',
  },
  tagText: {
    fontSize: 12,
    color: '#666',
  },
  deadlineText: {
    color: '#FF3B30',
  },
  viewConversation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 36,
  },
  viewConversationText: {
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

