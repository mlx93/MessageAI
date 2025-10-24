import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {router, useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import aiService from '../../services/aiService';
import {auth} from '../../services/firebase';
import {getFirestore, collection, query, where, orderBy, limit, getDocs} from 'firebase/firestore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ConversationOption {
  id: string;
  title: string;
  lastMessage?: string;
}

export default function ChatWithAvaScreen() {
  const params = useLocalSearchParams();
  const initialQuery = params.initialQuery as string;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Ava, your AI assistant. I can help you:\n\n• Summarize conversations\n• Find action items\n• Search your messages\n• Track decisions\n\nWhat can I help you with?",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState(initialQuery || '');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (initialQuery) {
      handleSend();
    }
  }, []);

  const loadConversations = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const db = getFirestore();
      const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId),
        orderBy('updatedAt', 'desc'),
        limit(20)
      );

      const snapshot = await getDocs(conversationsQuery);
      const convos: ConversationOption[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.isGroup ? data.name : data.displayName || 'Unknown',
          lastMessage: data.lastMessage?.text,
        };
      });

      setConversations(convos);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = inputText.trim();
    setInputText('');
    setLoading(true);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({animated: true});
    }, 100);

    try {
      const response = await getAvaResponse(query);
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error: any) {
      console.error('Error getting Ava response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  };

  const getAvaResponse = async (query: string): Promise<string> => {
    const lowerQuery = query.toLowerCase();
    const userId = auth.currentUser?.uid;

    if (!userId) {
      return "Please log in to use AI features.";
    }

    // Summarize conversation
    if (lowerQuery.includes('summarize')) {
      // Check if user specified a conversation
      const convoMatch = conversations.find((c) =>
        lowerQuery.includes(c.title.toLowerCase())
      );

      if (convoMatch) {
        try {
          const result = await aiService.summarizeThread(convoMatch.id, 50);
          return `📝 **Summary of ${convoMatch.title}:**\n\n${result.summary}\n\n**Key Topics:** ${result.keyTopics?.join(', ') || 'None'}\n**Participants:** ${result.participants?.join(', ') || 'Unknown'}`;
        } catch (error: any) {
          return `Sorry, I couldn't summarize that conversation: ${error.message}`;
        }
      } else if (conversations.length > 0) {
        // Show list of conversations to choose from
        const convoList = conversations
          .slice(0, 5)
          .map((c, i) => `${i + 1}. ${c.title}`)
          .join('\n');
        return `Which conversation would you like me to summarize?\n\n${convoList}\n\nJust tell me the name of the conversation!`;
      } else {
        return "You don't have any conversations yet.";
      }
    }

    // Search messages
    else if (lowerQuery.includes('search') || lowerQuery.includes('find')) {
      const searchTerm = query
        .replace(/search|find|for|me/gi, '')
        .trim();

      if (searchTerm.length < 3) {
        return "What would you like me to search for? Please provide more details.";
      }

      try {
        const results = await aiService.smartSearch(searchTerm, userId, 5);
        if (results.length === 0) {
          return `I couldn't find any messages matching "${searchTerm}". Try different keywords!`;
        }

        const resultText = results
          .map(
            (r, i) =>
              `${i + 1}. "${r.text}" (from ${r.sender}, score: ${(r.score * 100).toFixed(0)}%)`
          )
          .join('\n\n');

        return `🔍 **Search Results for "${searchTerm}":**\n\n${resultText}`;
      } catch (error: any) {
        return `Sorry, search failed: ${error.message}`;
      }
    }

    // Action items
    else if (
      lowerQuery.includes('action') ||
      lowerQuery.includes('task') ||
      lowerQuery.includes('todo')
    ) {
      return "You can view all your action items in the Action Items tab. I automatically detect tasks from your conversations and track them for you!\n\nJust tap the 'Action Items' button on the Ava screen.";
    }

    // Decisions
    else if (lowerQuery.includes('decision') || lowerQuery.includes('decide')) {
      return "Check out the Decisions tab to see all the decisions your team has made. I automatically extract and track important decisions from your conversations.\n\nJust tap the 'Decisions' button on the Ava screen.";
    }

    // Help
    else if (lowerQuery.includes('help')) {
      return "I can help you with:\n\n1. 📝 **Summarize conversations** - Say 'summarize [conversation name]'\n2. ✅ **View action items** - Go to Action Items tab\n3. 🔍 **Search messages** - Say 'search for [topic]'\n4. 📌 **Track decisions** - Go to Decisions tab\n5. 🔴 **Priority messages** - I detect them automatically!\n\nWhat would you like to do?";
    }

    // Default response
    else {
      return "I'm not sure how to help with that. Try asking me to:\n\n• 'Summarize [conversation name]'\n• 'Search for [topic]'\n• View action items or decisions\n\nOr just ask 'help' to see what I can do!";
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Chat with Ava</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
          <View style={{width: 24}} />
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.role === 'user'
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}>
              {message.role === 'assistant' && (
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>✨</Text>
                </View>
              )}
              <View
                style={[
                  styles.bubbleContent,
                  message.role === 'user'
                    ? styles.userBubbleContent
                    : styles.assistantBubbleContent,
                ]}>
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'user' && styles.userMessageText,
                  ]}>
                  {message.content}
                </Text>
              </View>
            </View>
          ))}

          {loading && (
            <View style={[styles.messageBubble, styles.assistantBubble]}>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>✨</Text>
              </View>
              <View style={[styles.bubbleContent, styles.assistantBubbleContent]}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.typingText}>Ava is thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ask Ava anything..."
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || loading) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || loading}>
              <Ionicons
                name="send"
                size={20}
                color={inputText.trim() && !loading ? '#007AFF' : '#CCC'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  keyboardAvoid: {
    flex: 1,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 16,
  },
  messageBubble: {
    flexDirection: 'row',
    gap: 8,
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  assistantBubble: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
  },
  bubbleContent: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  userBubbleContent: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  assistantBubbleContent: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#000',
  },
  userMessageText: {
    color: '#FFF',
  },
  typingText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  inputContainer: {
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    padding: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

