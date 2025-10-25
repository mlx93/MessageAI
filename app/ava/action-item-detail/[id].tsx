import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {router, useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {doc, getDoc, collection, query, getDocs, updateDoc, serverTimestamp, orderBy} from 'firebase/firestore';
import {db, auth} from '../../../services/firebase';
import {ActionItem} from '../../../services/aiService';
import {format, formatDistanceToNow} from 'date-fns';

interface MessageSnippet {
  id: string;
  senderName: string;
  text: string;
  timestamp: Date;
  senderId: string;
  isSourceMessage?: boolean;
}

export default function ActionItemDetailScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const [actionItem, setActionItem] = useState<(ActionItem & {id: string}) | null>(null);
  const [messageSnippets, setMessageSnippets] = useState<MessageSnippet[]>([]);
  const [conversationName, setConversationName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    loadActionItem();
  }, [id]);

  const loadActionItem = async () => {
    if (!id || !auth.currentUser?.uid) return;

    try {
      setLoading(true);

      // Get the action item document
      const actionItemDoc = await getDoc(doc(db, 'action_items', id));
      if (!actionItemDoc.exists()) {
        console.error('Action item not found');
        router.back();
        return;
      }

      const actionItemData = {
        id: actionItemDoc.id,
        ...actionItemDoc.data(),
      } as ActionItem & {id: string};

      setActionItem(actionItemData);

      // Get the conversation to access participant details
      const convDoc = await getDoc(doc(db, 'conversations', actionItemData.conversationId));
      if (!convDoc.exists()) {
        console.error('Conversation not found');
        setLoading(false);
        return;
      }

      const convData = convDoc.data();
      const participantDetails = convData?.participantDetails || {};

      // Set conversation name
      const userId = auth.currentUser?.uid;
      if (convData.isGroup) {
        setConversationName(convData.groupName || 'Group Chat');
      } else if (participantDetails) {
        const names = Object.entries(participantDetails)
          .filter(([id]) => id !== userId)
          .map(([, details]: [string, any]) => details.displayName)
          .filter(Boolean)
          .join(', ');
        setConversationName(names || 'Direct Message');
      }

      // Fetch messages for context
      if (actionItemData.messageId) {
        const messagesRef = collection(db, `conversations/${actionItemData.conversationId}/messages`);
        const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
        const messagesSnapshot = await getDocs(messagesQuery);

        // Build a list of all messages sorted by timestamp
        const allMessages = messagesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            senderId: data.senderId,
            text: data.text || '',
            timestamp: data.timestamp?.toDate() || new Date(),
          };
        });

        // Find the source message index
        const sourceMessageIndex = allMessages.findIndex(m => m.id === actionItemData.messageId);
        
        if (sourceMessageIndex >= 0) {
          // Get 3 messages before and 5 messages after for context
          const startIndex = Math.max(0, sourceMessageIndex - 3);
          const endIndex = Math.min(allMessages.length, sourceMessageIndex + 6);
          const contextMessages = allMessages.slice(startIndex, endIndex);

          // Map to message snippets with sender names
          const snippets: MessageSnippet[] = contextMessages.map(message => {
            const senderProfile = participantDetails[message.senderId];
            const senderName = senderProfile?.displayName || message.senderId.slice(0, 8);

            return {
              id: message.id,
              senderName,
              text: message.text,
              timestamp: message.timestamp,
              senderId: message.senderId,
              isSourceMessage: message.id === actionItemData.messageId,
            };
          });

          setMessageSnippets(snippets);
        }
      }
    } catch (error) {
      console.error('Error loading action item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!actionItem) return;

    Alert.alert(
      'Complete Action Item',
      'Mark this action item as completed?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            setCompleting(true);
            try {
              await updateDoc(doc(db, 'action_items', actionItem.id), {
                status: 'completed',
                completedAt: serverTimestamp(),
              });
              Alert.alert('Success', 'Action item marked as complete', [
                {
                  text: 'OK',
                  onPress: () => router.back(),
                },
              ]);
            } catch (error) {
              console.error('Error completing action item:', error);
              Alert.alert('Error', 'Failed to complete action item');
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Action Item Details</Text>
          <View style={{width: 24}} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!actionItem) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Action Item Details</Text>
          <View style={{width: 24}} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Action item not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#34C759';
    if (confidence >= 0.6) return '#FF9500';
    return '#FF3B30';
  };

  const userId = auth.currentUser?.uid;
  const isPersonal = actionItem.assigneeId === userId;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Action Item Details</Text>
        <TouchableOpacity
          onPress={() => router.push(`/chat/${actionItem.conversationId}`)}
          style={styles.chatButton}>
          <Ionicons name="chatbubbles-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Action Item Card */}
        <View style={[styles.actionItemCard, isPersonal && styles.actionItemCardPersonal]}>
          <View style={styles.cardHeader}>
            <Text style={styles.actionItemLabel}>Action Item</Text>
            <Text style={styles.dateText}>
              {(() => {
                try {
                  let timestamp: any = actionItem.createdAt;
                  
                  if (timestamp && typeof timestamp === 'object' && 'toMillis' in timestamp) {
                    timestamp = timestamp.toMillis();
                  } else if (timestamp && typeof timestamp === 'object') {
                    const dateObj = timestamp as Date;
                    if (dateObj.getTime) {
                      timestamp = dateObj.getTime();
                    }
                  }
                  
                  if (typeof timestamp === 'number') {
                    if (timestamp < 946684800000) {
                      timestamp = timestamp * 1000;
                    }
                    
                    const createdAtDate = new Date(timestamp);
                    
                    if (!isNaN(createdAtDate.getTime()) && createdAtDate.getFullYear() > 2000) {
                      return format(createdAtDate, 'MMM d, yyyy');
                    }
                  }
                  
                  return format(new Date(), 'MMM d, yyyy');
                } catch (error) {
                  console.log('Date formatting error:', error);
                  return format(new Date(), 'MMM d, yyyy');
                }
              })()}
            </Text>
          </View>
          <Text style={styles.taskText}>{actionItem.task}</Text>
          
          {conversationName && (
            <View style={styles.conversationBadge}>
              <Ionicons name="chatbubbles-outline" size={14} color="#666" />
              <Text style={styles.conversationBadgeText}>{conversationName}</Text>
            </View>
          )}
        </View>

        {/* Context */}
        {actionItem.context && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Context</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.contextText}>{actionItem.context}</Text>
            </View>
          </View>
        )}

        {/* Assignment & Deadline */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Details</Text>
          <View style={styles.sectionCard}>
            {actionItem.assignee ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Assigned to</Text>
                <View style={[styles.assigneeBadge, isPersonal && styles.assigneeBadgePersonal]}>
                  <Ionicons 
                    name="person" 
                    size={14} 
                    color={isPersonal ? "#007AFF" : "#666"} 
                  />
                  <Text style={[styles.assigneeText, isPersonal && styles.assigneeTextPersonal]}>
                    {actionItem.assignee}
                    {isPersonal && ' (You)'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Assigned to</Text>
                <View style={styles.unassignedBadge}>
                  <Ionicons name="help-circle-outline" size={14} color="#FF9500" />
                  <Text style={styles.unassignedText}>Unassigned</Text>
                </View>
              </View>
            )}
            
            {actionItem.deadline && (() => {
              try {
                const deadlineDate = actionItem.deadline instanceof Date
                  ? actionItem.deadline
                  : actionItem.deadline?.toDate?.()
                  ? actionItem.deadline.toDate()
                  : new Date(actionItem.deadline);
                
                if (!isNaN(deadlineDate.getTime())) {
                  return (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Deadline</Text>
                      <View style={styles.deadlineBadge}>
                        <Ionicons name="calendar-outline" size={14} color="#FF3B30" />
                        <Text style={styles.deadlineText}>
                          {formatDistanceToNow(deadlineDate, {addSuffix: true})}
                        </Text>
                      </View>
                    </View>
                  );
                }
              } catch (error) {
                console.log('Error formatting deadline:', error);
              }
              return null;
            })()}
          </View>
        </View>

        {/* Confidence Score */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Confidence Score</Text>
          <View style={styles.sectionCard}>
            <View style={styles.confidenceRow}>
              <View style={styles.confidenceBarContainer}>
                <View
                  style={[
                    styles.confidenceBar,
                    {
                      width: `${actionItem.confidence * 100}%`,
                      backgroundColor: getConfidenceColor(actionItem.confidence),
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.confidencePercentage,
                  {color: getConfidenceColor(actionItem.confidence)},
                ]}>
                {Math.round(actionItem.confidence * 100)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Message Snippets */}
        {messageSnippets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Conversation Context</Text>
            <View style={styles.messagesContainer}>
              {messageSnippets.map((snippet, index) => (
                <View key={snippet.id}>
                  {index > 0 && <View style={styles.messageConnector} />}
                  <View 
                    style={[
                      styles.messageSnippet,
                      snippet.isSourceMessage && styles.messageSnippetHighlighted
                    ]}>
                    <View style={styles.messageHeader}>
                      <View style={styles.messageSenderRow}>
                        <Text style={styles.messageSender}>{snippet.senderName}</Text>
                        {snippet.isSourceMessage && (
                          <View style={styles.sourceBadge}>
                            <Ionicons name="flag" size={10} color="#007AFF" />
                            <Text style={styles.sourceBadgeText}>Source</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.messageTime}>
                        {format(snippet.timestamp, 'MMM d, h:mm a')}
                      </Text>
                    </View>
                    <Text style={styles.messageText}>{snippet.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Complete Button */}
        {actionItem.status === 'pending' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleComplete}
              disabled={completing}>
              {completing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={styles.completeButtonText}>Mark as Complete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{height: 40}} />
      </ScrollView>
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
  chatButton: {
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  content: {
    flex: 1,
  },
  actionItemCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  actionItemCardPersonal: {
    backgroundColor: '#E8F2FF',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionItemLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 13,
    color: '#999',
  },
  taskText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    lineHeight: 26,
    marginBottom: 12,
  },
  conversationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F1F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  conversationBadgeText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  contextText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  assigneeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F1F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  assigneeBadgePersonal: {
    backgroundColor: '#E8F2FF',
  },
  assigneeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  assigneeTextPersonal: {
    color: '#007AFF',
  },
  unassignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  unassignedText: {
    fontSize: 14,
    color: '#FF9500',
    fontWeight: '600',
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  deadlineText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confidenceBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceBar: {
    height: '100%',
    borderRadius: 4,
  },
  confidencePercentage: {
    fontSize: 16,
    fontWeight: '600',
  },
  messagesContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  messageSnippet: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
  },
  messageSnippetHighlighted: {
    backgroundColor: '#FFF9E6',
    borderLeftWidth: 3,
    borderLeftColor: '#FFB800',
  },
  messageConnector: {
    position: 'absolute',
    left: 8,
    top: -16,
    width: 2,
    height: 16,
    backgroundColor: '#E5E5E5',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  messageSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E8F2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontSize: 10,
    color: '#007AFF',
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  completeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

