import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {router, useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {doc, getDoc, collection, query, where, getDocs} from 'firebase/firestore';
import {db, auth} from '../../services/firebase';
import {Decision} from '../../services/aiService';
import {format} from 'date-fns';
import {Message} from '../../types';

interface MessageSnippet {
  id: string;
  senderName: string;
  text: string;
  timestamp: Date;
  senderId: string;
}

export default function DecisionDetailScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const [decision, setDecision] = useState<(Decision & {id: string}) | null>(null);
  const [messageSnippets, setMessageSnippets] = useState<MessageSnippet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDecision();
  }, [id]);

  const loadDecision = async () => {
    if (!id || !auth.currentUser?.uid) return;

    try {
      setLoading(true);

      // Get the decision document
      const decisionDoc = await getDoc(doc(db, 'decisions', id));
      if (!decisionDoc.exists()) {
        console.error('Decision not found');
        router.back();
        return;
      }

      const decisionData = {
        id: decisionDoc.id,
        ...decisionDoc.data(),
      } as Decision & {id: string};

      setDecision(decisionData);

      // Get the conversation to access participant details
      const convDoc = await getDoc(doc(db, 'conversations', decisionData.conversationId));
      if (!convDoc.exists()) {
        console.error('Conversation not found');
        setLoading(false);
        return;
      }

      const convData = convDoc.data();
      const participantDetails = convData?.participantDetails || {};

      // Fetch the relevant messages based on messageIds
      if (decisionData.messageIds && decisionData.messageIds.length > 0) {
        // Get all messages from the conversation
        const messagesRef = collection(db, `conversations/${decisionData.conversationId}/messages`);
        const messagesQuery = query(messagesRef);
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
        }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // messageIds from the decision are array indices
        const snippets: MessageSnippet[] = [];
        for (const messageIdOrIndex of decisionData.messageIds) {
          // Try to parse as an index first
          const index = parseInt(String(messageIdOrIndex), 10);
          let message;

          if (!isNaN(index) && index >= 0 && index < allMessages.length) {
            // It's a valid index
            message = allMessages[index];
          } else {
            // Try to find by ID
            message = allMessages.find(m => m.id === messageIdOrIndex);
          }

          if (message) {
            // Get sender name from participant details
            const senderProfile = participantDetails[message.senderId];
            const senderName = senderProfile?.displayName?.split(' ')[0] || 
                             message.senderId.slice(0, 4);

            snippets.push({
              id: message.id,
              senderName,
              text: message.text,
              timestamp: message.timestamp,
              senderId: message.senderId,
            });
          }
        }

        // Sort snippets by timestamp
        snippets.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        setMessageSnippets(snippets);
      }
    } catch (error) {
      console.error('Error loading decision:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Decision Details</Text>
          <View style={{width: 24}} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!decision) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Decision Details</Text>
          <View style={{width: 24}} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Decision not found</Text>
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Decision Details</Text>
        <TouchableOpacity
          onPress={() => router.push(`/chat/${decision.conversationId}`)}
          style={styles.chatButton}>
          <Ionicons name="chatbubbles-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Decision Card */}
        <View style={styles.decisionCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.decisionLabel}>Decision</Text>
            <Text style={styles.dateText}>
              {(() => {
                try {
                  let timestamp = decision.madeAt;
                  
                  // Convert to number if it's a Firestore Timestamp
                  if (timestamp && typeof timestamp === 'object' && 'toMillis' in timestamp) {
                    timestamp = (timestamp as any).toMillis();
                  } else if (timestamp && typeof timestamp === 'object' && timestamp instanceof Date) {
                    timestamp = timestamp.getTime();
                  }
                  
                  if (typeof timestamp === 'number') {
                    // Check if timestamp is in seconds (Unix epoch) instead of milliseconds
                    // Timestamps before year 2000 in milliseconds would be less than 946684800000
                    if (timestamp < 946684800000) {
                      timestamp = timestamp * 1000; // Convert seconds to milliseconds
                    }
                    
                    const madeAtDate = new Date(timestamp);
                    
                    if (!isNaN(madeAtDate.getTime()) && madeAtDate.getFullYear() > 2000) {
                      return format(madeAtDate, 'MMM d, yyyy');
                    }
                  }
                  
                  // Fallback
                  return format(new Date(), 'MMM d, yyyy');
                } catch (error) {
                  console.log('Date formatting error:', error);
                  return format(new Date(), 'MMM d, yyyy');
                }
              })()}
            </Text>
          </View>
          <Text style={styles.decisionText}>{decision.decision}</Text>
        </View>

        {/* Rationale */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Rationale</Text>
          <View style={styles.sectionCard}>
            <Text style={styles.rationaleText}>{decision.rationale}</Text>
          </View>
        </View>

        {/* Alternatives Considered */}
        {decision.alternativesConsidered && decision.alternativesConsidered.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Alternatives Considered</Text>
            <View style={styles.sectionCard}>
              {decision.alternativesConsidered.map((alt, index) => (
                <View key={index} style={styles.alternativeItem}>
                  <View style={styles.bulletPoint} />
                  <Text style={styles.alternativeText}>{alt}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Participants & Decision Maker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Team</Text>
          <View style={styles.sectionCard}>
            {decision.decisionMaker && 
             decision.decisionMaker !== 'undefined' && 
             decision.decisionMaker !== 'Unknown' && (
              <View style={styles.teamRow}>
                <Text style={styles.teamLabel}>Decision Maker</Text>
                <View style={styles.decisionMakerBadge}>
                  <Ionicons name="person" size={14} color="#007AFF" />
                  <Text style={styles.decisionMakerText}>{decision.decisionMaker}</Text>
                </View>
              </View>
            )}
            
            {decision.participants && decision.participants.length > 0 && (
              <View style={styles.teamRow}>
                <Text style={styles.teamLabel}>Participants</Text>
                <Text style={styles.participantsListText}>
                  {decision.participants
                    .filter(p => p && p !== 'undefined' && p !== 'Unknown')
                    .join(', ')}
                </Text>
              </View>
            )}
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
                      width: `${decision.confidence * 100}%`,
                      backgroundColor: getConfidenceColor(decision.confidence),
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.confidencePercentage,
                  {color: getConfidenceColor(decision.confidence)},
                ]}>
                {Math.round(decision.confidence * 100)}%
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
                <View key={snippet.id} style={styles.messageSnippet}>
                  {index > 0 && <View style={styles.messageConnector} />}
                  <View style={styles.messageHeader}>
                    <Text style={styles.messageSender}>{snippet.senderName}</Text>
                    <Text style={styles.messageTime}>
                      {format(snippet.timestamp, 'MMM d, h:mm a')}
                    </Text>
                  </View>
                  <Text style={styles.messageText}>{snippet.text}</Text>
                </View>
              ))}
            </View>
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
  decisionCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  decisionLabel: {
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
  decisionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    lineHeight: 26,
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
  rationaleText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  alternativeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007AFF',
    marginTop: 8,
    marginRight: 10,
  },
  alternativeText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  teamRow: {
    marginBottom: 16,
  },
  teamLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  decisionMakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  decisionMakerText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  participantsListText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
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
  messageSender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
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
});

