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
import {doc, getDoc, collection, query, orderBy, getDocs} from 'firebase/firestore';
import {db, auth} from '../../../services/firebase';
import {format} from 'date-fns';

interface MessageDetail {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  isHighlighted?: boolean;
}

export default function SearchResultDetailScreen() {
  const {messageId, conversationId} = useLocalSearchParams<{
    messageId: string;
    conversationId: string;
  }>();
  const [messages, setMessages] = useState<MessageDetail[]>([]);
  const [conversationName, setConversationName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  useEffect(() => {
    loadMessageContext();
  }, [messageId, conversationId]);

  const loadMessageContext = async () => {
    if (!messageId || !conversationId || !auth.currentUser?.uid) return;

    try {
      setLoading(true);

      // Get the conversation to access participant details
      const convDoc = await getDoc(doc(db, 'conversations', conversationId));
      if (!convDoc.exists()) {
        console.error('Conversation not found');
        router.back();
        return;
      }

      const convData = convDoc.data();
      const participantDetails = convData?.participantDetails || {};

      // Derive conversation name
      if (convData.isGroup) {
        setConversationName(convData.groupName || 'Group Chat');
      } else {
        const otherParticipants = Object.entries(participantDetails)
          .filter(([id]) => id !== auth.currentUser?.uid)
          .map(([, details]: [string, any]) => details.displayName)
          .filter(Boolean);
        setConversationName(otherParticipants.join(', ') || 'Direct Message');
      }

      // Fetch all messages from the conversation
      const messagesRef = collection(db, `conversations/${conversationId}/messages`);
      const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
      const messagesSnapshot = await getDocs(messagesQuery);

      const allMessages = messagesSnapshot.docs.map(doc => {
        const data = doc.data();
        const senderId = data.senderId;
        const senderProfile = participantDetails[senderId];
        const senderName = senderProfile?.displayName || 'Unknown';

        return {
          id: doc.id,
          text: data.text || '',
          senderId,
          senderName,
          timestamp: data.timestamp?.toDate() || new Date(),
        };
      });

      // Find the index of the highlighted message
      const targetIndex = allMessages.findIndex(m => m.id === messageId);
      if (targetIndex === -1) {
        console.error('Message not found in conversation');
        router.back();
        return;
      }

      setHighlightedIndex(targetIndex);

      // Get 10 messages before and 10 after (21 total including target)
      const CONTEXT_SIZE = 10;
      const startIndex = Math.max(0, targetIndex - CONTEXT_SIZE);
      const endIndex = Math.min(allMessages.length, targetIndex + CONTEXT_SIZE + 1);
      
      const contextMessages = allMessages.slice(startIndex, endIndex).map(msg => ({
        ...msg,
        isHighlighted: msg.id === messageId,
      }));

      setMessages(contextMessages);
    } catch (error) {
      console.error('Error loading message context:', error);
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
          <Text style={styles.title}>Message Details</Text>
          <View style={{width: 24}} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Message Details</Text>
          <Text style={styles.subtitle}>{conversationName}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push(`/chat/${conversationId}`)}
          style={styles.chatButton}>
          <Ionicons name="chatbubbles-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.messagesContainer}>
        {messages.length > 0 ? (
          <>
            {messages.map((message, index) => (
              <View
                key={message.id}
                style={[
                  styles.messageCard,
                  message.isHighlighted && styles.highlightedMessage,
                ]}>
                {message.isHighlighted && (
                  <View style={styles.highlightBadge}>
                    <Ionicons name="search" size={14} color="#007AFF" />
                    <Text style={styles.highlightText}>Search Result</Text>
                  </View>
                )}
                <View style={styles.messageHeader}>
                  <Text style={styles.senderName}>{message.senderName}</Text>
                  <Text style={styles.messageTime}>
                    {format(message.timestamp, 'MMM d, h:mm a')}
                  </Text>
                </View>
                <Text style={styles.messageText}>{message.text}</Text>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages found</Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#007AFF" />
          <Text style={styles.actionButtonText}>Back to Results</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryActionButton]}
          onPress={() => router.push(`/chat/${conversationId}`)}>
          <Ionicons name="chatbubbles" size={20} color="#FFF" />
          <Text style={[styles.actionButtonText, styles.primaryActionButtonText]}>
            Open Chat
          </Text>
        </TouchableOpacity>
      </View>
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
  },
  messageCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  highlightedMessage: {
    backgroundColor: '#F0F8FF',
    borderWidth: 2,
    borderColor: '#007AFF',
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  highlightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  highlightText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  primaryActionButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  primaryActionButtonText: {
    color: '#FFF',
  },
});

