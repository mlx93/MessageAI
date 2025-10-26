import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/AuthContext';
import { getFirestore, collection, query, where, orderBy, getDocs, doc as firestoreDoc, getDoc } from 'firebase/firestore';
import { app } from '../../services/firebase';
import { format, isToday, isYesterday } from 'date-fns';
import { Message } from '../../types';

interface PriorityMessage extends Message {
  conversationName: string;
  senderName: string;
}

export default function PriorityInboxScreen() {
  const { user } = useAuth();
  const [urgentMessages, setUrgentMessages] = useState<PriorityMessage[]>([]);
  const [importantMessages, setImportantMessages] = useState<PriorityMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'urgent' | 'important'>('all');
  const db = getFirestore(app);

  const loadPriorityMessages = async () => {
    if (!user) return;

    try {
      // Get user's conversations
      const userConversationsQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid)
      );
      const conversationsSnapshot = await getDocs(userConversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map(doc => doc.id);
      const conversationMap = new Map(
        conversationsSnapshot.docs.map(doc => [doc.id, doc.data()])
      );

      // Fetch priority messages from all user conversations (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const allPriorityMessages: PriorityMessage[] = [];

      // Batch fetch messages from each conversation
      for (const conversationId of conversationIds) {
        const messagesQuery = query(
          collection(db, `conversations/${conversationId}/messages`),
          where('timestamp', '>=', sevenDaysAgo),
          orderBy('timestamp', 'desc')
        );
        
        const messagesSnapshot = await getDocs(messagesQuery);
        
        for (const messageDoc of messagesSnapshot.docs) {
          const messageData = messageDoc.data();
          
          // Filter for urgent/important messages not deleted by user
          if (
            messageData.priority &&
            (messageData.priority === 'urgent' || messageData.priority === 'important') &&
            (!messageData.deletedBy || !messageData.deletedBy.includes(user.uid))
          ) {
            const conversationData = conversationMap.get(conversationId);
            
            // Get conversation name
            let conversationName = 'Unknown';
            if (conversationData) {
              if (conversationData.type === 'direct') {
                const otherUserId = conversationData.participants.find((id: string) => id !== user.uid);
                conversationName = conversationData.participantDetails?.[otherUserId]?.displayName || 'Chat';
              } else {
                const names = conversationData.participants
                  .filter((id: string) => id !== user.uid)
                  .map((id: string) => conversationData.participantDetails?.[id]?.displayName?.split(' ')[0] || 'User')
                  .slice(0, 3)
                  .join(', ');
                conversationName = names + (conversationData.participants.length > 4 ? '...' : '');
              }
            }

            // Get sender name
            const senderName = conversationData?.participantDetails?.[messageData.senderId]?.displayName || 'Unknown';

            allPriorityMessages.push({
              id: messageDoc.id,
              conversationId,
              text: messageData.text || '',
              senderId: messageData.senderId || '',
              timestamp: messageData.timestamp?.toDate() || new Date(),
              status: messageData.status || 'sent',
              type: messageData.type || 'text',
              localId: messageData.localId || messageDoc.id,
              readBy: messageData.readBy || [],
              deliveredTo: messageData.deliveredTo || [],
              priority: messageData.priority,
              priorityConfidence: messageData.priorityConfidence,
              priorityReason: messageData.priorityReason,
              conversationName,
              senderName,
            });
          }
        }
      }

      // Sort by timestamp (most recent first)
      allPriorityMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Split into urgent and important
      setUrgentMessages(allPriorityMessages.filter(m => m.priority === 'urgent'));
      setImportantMessages(allPriorityMessages.filter(m => m.priority === 'important'));
    } catch (error) {
      console.error('Failed to load priority messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPriorityMessages();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPriorityMessages();
  };

  const handleMessagePress = (message: PriorityMessage) => {
    router.push(`/chat/${message.conversationId}`);
  };

  const formatTimestamp = (timestamp: Date): string => {
    if (isToday(timestamp)) {
      return format(timestamp, 'h:mm a');
    } else if (isYesterday(timestamp)) {
      return 'Yesterday';
    } else {
      return format(timestamp, 'MMM d');
    }
  };

  const renderMessage = ({ item }: { item: PriorityMessage }) => {
    const priorityColor = item.priority === 'urgent' ? '#FF3B30' : '#FF9500';
    const priorityIcon = item.priority === 'urgent' ? '🔴' : '🟡';
    const priorityLabel = item.priority === 'urgent' ? 'Urgent' : 'Important';

    return (
      <TouchableOpacity
        style={styles.messageCard}
        onPress={() => handleMessagePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.messageHeader}>
          <View style={styles.conversationInfo}>
            <Text style={styles.conversationName} numberOfLines={1}>
              {item.conversationName}
            </Text>
            <Text style={styles.senderName} numberOfLines={1}>
              {item.senderName}
            </Text>
          </View>
          <View style={styles.metaInfo}>
            <View style={[styles.priorityBadge, { borderColor: priorityColor }]}>
              <Text style={styles.priorityIcon}>{priorityIcon}</Text>
              <Text style={[styles.priorityLabel, { color: priorityColor }]}>
                {priorityLabel}
              </Text>
            </View>
            <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
          </View>
        </View>
        <Text style={styles.messageText} numberOfLines={3}>
          {item.text}
        </Text>
        {item.priorityReason && (
          <Text style={styles.reasonText} numberOfLines={2}>
            {item.priorityReason}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const getFilteredMessages = () => {
    if (selectedFilter === 'urgent') return urgentMessages;
    if (selectedFilter === 'important') return importantMessages;
    return [...urgentMessages, ...importantMessages];
  };

  const filteredMessages = getFilteredMessages();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Priority Inbox',
          headerBackTitle: 'Ava',
        }}
      />
      <View style={styles.container}>
        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[styles.filterTab, selectedFilter === 'all' && styles.filterTabActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterTabText, selectedFilter === 'all' && styles.filterTabTextActive]}>
              All ({urgentMessages.length + importantMessages.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, selectedFilter === 'urgent' && styles.filterTabActive]}
            onPress={() => setSelectedFilter('urgent')}
          >
            <Text style={[styles.filterTabText, selectedFilter === 'urgent' && styles.filterTabTextActive]}>
              🔴 Urgent ({urgentMessages.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, selectedFilter === 'important' && styles.filterTabActive]}
            onPress={() => setSelectedFilter('important')}
          >
            <Text style={[styles.filterTabText, selectedFilter === 'important' && styles.filterTabTextActive]}>
              🟡 Important ({importantMessages.length})
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading priority messages...</Text>
          </View>
        ) : filteredMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>
              No priority messages in the last 7 days
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredMessages}
            keyExtractor={(item) => `${item.conversationId}-${item.id}`}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: '#007AFF',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#007AFF',
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  conversationInfo: {
    flex: 1,
    marginRight: 12,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  senderName: {
    fontSize: 14,
    color: '#666',
  },
  metaInfo: {
    alignItems: 'flex-end',
    gap: 4,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  priorityIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  priorityLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#333',
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666',
    fontStyle: 'italic',
  },
});

