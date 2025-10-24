import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import aiService, {ActionItem} from '../../services/aiService';

interface ActionItemsBannerProps {
  conversationId: string;
  onViewAll: () => void;
}

export default function ActionItemsBanner({
  conversationId,
  onViewAll,
}: ActionItemsBannerProps) {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = aiService
      .getActionItems(conversationId)
      .limit(3)
      .onSnapshot((snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ActionItem[];
        setActionItems(items);
        setLoading(false);
      });

    return () => unsubscribe();
  }, [conversationId]);

  const handleComplete = async (itemId: string) => {
    setCompleting(itemId);
    try {
      await aiService.completeActionItem(itemId);
    } catch (error) {
      console.error('Error completing action item:', error);
    } finally {
      setCompleting(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }

  if (actionItems.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#007AFF" />
          <Text style={styles.title}>
            {actionItems.length} Action Item{actionItems.length > 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={onViewAll} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.itemsList}>
        {actionItems.map((item) => (
          <View key={item.messageId} style={styles.item}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => handleComplete(item.messageId)}
              disabled={completing === item.messageId}>
              {completing === item.messageId ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Ionicons name="ellipse-outline" size={18} color="#007AFF" />
              )}
            </TouchableOpacity>
            <View style={styles.itemContent}>
              <Text style={styles.itemTask} numberOfLines={1}>
                {item.task}
              </Text>
              {item.assignee && (
                <Text style={styles.itemAssignee}>→ {item.assignee}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFF9E6',
    borderBottomWidth: 1,
    borderBottomColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 16,
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
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  viewAll: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  itemsList: {
    gap: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemTask: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  itemAssignee: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
});

