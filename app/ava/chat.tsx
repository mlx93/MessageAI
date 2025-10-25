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
  Clipboard,
} from 'react-native';
import {router, useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';
import aiService from '../../services/aiService';
import avaChatHistory from '../../services/avaChatHistory';
import {auth} from '../../services/firebase';
import {getFirestore, collection, query as firestoreQuery, where, orderBy, limit, getDocs} from 'firebase/firestore';

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
  isGroup?: boolean;
  participantDetails?: any;
  participants?: string[];
  updatedAt?: any;
}

export default function ChatWithAvaScreen() {
  const params = useLocalSearchParams();
  const initialQuery = params.initialQuery as string;
  const sessionId = params.sessionId as string;

  // Only show welcome message for new sessions (no sessionId)
  const [messages, setMessages] = useState<Message[]>(
    sessionId ? [] : [{
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Ava, your AI assistant. I can help you:\n\n• Summarize conversations (by name or person)\n• Find information about people in your chats\n• Search your messages\n• Track action items and decisions\n• Show your action items and tasks\n\nI can recognize first names, last names, and full names from your conversation history!\n\nWhat can I help you with?",
      timestamp: Date.now(),
    }]
  );
  const [inputText, setInputText] = useState(initialQuery || '');
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>(sessionId || avaChatHistory.generateSessionId());
  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    loadConversations();
    loadChatSession();
  }, []);

  useEffect(() => {
    // Only send initial query after conversations are loaded
    if (initialQuery && conversationsLoaded) {
      handleSend();
    }
  }, [conversationsLoaded]);

  const loadChatSession = async () => {
    if (sessionId) {
      try {
        const sessionMessages = await avaChatHistory.getChatMessages(sessionId);
        if (sessionMessages.length > 0) {
          setMessages(sessionMessages);
        }
      } catch (error) {
        console.error('Ava: Error loading chat session:', error);
      }
    }
  };

  const loadConversations = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('Ava: No user ID available');
        return;
      }

      console.log('Ava: Loading conversations for user:', userId);
      const db = getFirestore();
      const conversationsQuery = firestoreQuery(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId),
        orderBy('updatedAt', 'desc'),
        limit(20)
      );

      const snapshot = await getDocs(conversationsQuery);
      console.log('Ava: Found conversations:', snapshot.docs.length);
      
      const convos: ConversationOption[] = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          let title = 'Unknown';
          
          if (data.isGroup) {
            title = data.name || 'Group Chat';
          } else {
            // For direct conversations, show all participant names
            if (data.participantDetails) {
              const participantNames = Object.entries(data.participantDetails)
                .map(([, details]: [string, any]) => details.displayName)
                .filter(Boolean)
                .join(', ');
              title = participantNames || 'Unknown';
            }
          }
          
          return {
            id: doc.id,
            title,
            lastMessage: data.lastMessage?.text,
            isGroup: data.isGroup,
            participantDetails: data.participantDetails,
            participants: data.participants,
            updatedAt: data.updatedAt,
          };
        })
        // Filter to only show active conversations with actual messages (same as Messages page)
        .filter(conversation => {
          const hasMessageText = conversation.lastMessage && 
                                conversation.lastMessage.trim() !== '' && 
                                conversation.lastMessage !== 'Photo' &&
                                conversation.lastMessage !== '📷 Image' &&
                                conversation.lastMessage !== 'Start a conversation';
          return hasMessageText;
        })
        // Remove duplicates by title (keep the most recent one)
        .reduce((acc, current) => {
          const existing = acc.find(conv => conv.title === current.title);
          if (!existing || current.updatedAt > existing.updatedAt) {
            if (existing) {
              const index = acc.indexOf(existing);
              acc[index] = current;
            } else {
              acc.push(current);
            }
          }
          return acc;
        }, [] as ConversationOption[]);

      console.log('Ava: Processed conversations:', convos.map(c => ({ title: c.title, id: c.id })));
      setConversations(convos);
      setConversationsLoaded(true); // Signal that conversations are ready
    } catch (error) {
      console.error('Ava: Error loading conversations:', error);
      setConversationsLoaded(true); // Set to true even on error so UI doesn't hang
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage: Message = {
      id: avaChatHistory.generateMessageId(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
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
        id: avaChatHistory.generateMessageId(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      
      const finalMessages = [...newMessages, aiResponse];
      setMessages(finalMessages);
      
      // Save session and messages
      await saveChatSession(finalMessages, query);
    } catch (error: any) {
      console.error('Error getting Ava response:', error);
      const errorMessage: Message = {
        id: avaChatHistory.generateMessageId(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
        timestamp: Date.now(),
      };
      
      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
      
      // Save session and messages even for errors
      await saveChatSession(finalMessages, query);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  };

  const saveChatSession = async (messages: Message[], userQuery: string) => {
    try {
      // Generate a title from the first user message
      const title = userQuery.length > 50 ? userQuery.substring(0, 50) + '...' : userQuery;
      const lastMessage = messages[messages.length - 1]?.content || '';
      
      // Save session
      await avaChatHistory.saveChatSession(
        currentSessionId,
        title,
        lastMessage,
        messages.length
      );
      
      // Save messages
      await avaChatHistory.saveChatMessages(currentSessionId, messages);
    } catch (error) {
      console.error('Ava: Error saving chat session:', error);
    }
  };

  const handleCopyMessage = async (content: string) => {
    try {
      await Clipboard.setString(content);
      // You could add a toast notification here if you have a toast library
      console.log('Message copied to clipboard');
    } catch (error) {
      console.error('Error copying message:', error);
    }
  };

  // Enhanced name recognition utilities
  const extractNamesFromQuery = (query: string): { firstName?: string; lastName?: string; fullName?: string } => {
    const words = query.split(' ').filter(word => word.length > 1);
    const names: { firstName?: string; lastName?: string; fullName?: string } = {};
    
    // Look for common name patterns
    const namePatterns = [
      /(?:with|to|from)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)/, // "with John Smith"
      /(?:with|to|from)\s+([A-Z][a-z]+)/, // "with John"
      /([A-Z][a-z]+)\s+([A-Z][a-z]+)/, // "John Smith"
      /([A-Z][a-z]+)/, // "John"
    ];
    
    for (const pattern of namePatterns) {
      const match = query.match(pattern);
      if (match) {
        if (match[2]) {
          names.firstName = match[1];
          names.lastName = match[2];
          names.fullName = `${match[1]} ${match[2]}`;
        } else {
          names.firstName = match[1];
        }
        break;
      }
    }
    
    return names;
  };

  const findConversationByName = (nameQuery: string): ConversationOption | null => {
    const extractedNames = extractNamesFromQuery(nameQuery);
    const searchTerms = [
      extractedNames.fullName,
      extractedNames.firstName,
      extractedNames.lastName,
      ...nameQuery.split(' ').filter(word => word.length > 2)
    ].filter(Boolean);
    
    console.log('Ava: Searching for conversations with names:', searchTerms);
    console.log('Ava: Available conversations:', conversations.map(c => c.title));
    
    // Extract actual names from the query (not filler words)
    const actualNames = searchTerms.filter(term => 
      !['summarize', 'conversation', 'with', 'and', 'my', 'the'].includes(term.toLowerCase())
    );
    
    // De-duplicate names (case-insensitive)
    const uniqueNames = Array.from(
      new Set(actualNames.map(name => name.toLowerCase()))
    );
    
    console.log('Ava: Actual names from query:', actualNames);
    console.log('Ava: Unique names:', uniqueNames);
    
    // Try to find conversations where all actual names match participants
    const matchedConversations = conversations.filter(conv => {
      const titleLower = conv.title.toLowerCase();
      // Check if all actual names are in the title
      return actualNames.every(name => 
        titleLower.includes(name.toLowerCase())
      );
    });
    
    console.log('Ava: Matched conversations:', matchedConversations.map(c => 
      `${c.title} (${c.participants?.length || 0} participants)`
    ));
    
    if (matchedConversations.length > 0) {
      // If we have multiple matches, prioritize by exact participant count
      // Expected participant count = number of UNIQUE names mentioned + current user
      const expectedCount = uniqueNames.length + 1;
      
      console.log('Ava: Expected participant count:', expectedCount);
      
      // Sort by: exact participant count match, then fewest total participants
      const sortedMatches = matchedConversations.sort((a, b) => {
        const aParticipantCount = a.participants?.length || 0;
        const bParticipantCount = b.participants?.length || 0;
        
        console.log(`Ava: Comparing - ${a.title} (${aParticipantCount}) vs ${b.title} (${bParticipantCount})`);
        
        const aIsExact = aParticipantCount === expectedCount;
        const bIsExact = bParticipantCount === expectedCount;
        
        if (aIsExact && !bIsExact) {
          console.log(`Ava: ${a.title} is exact match!`);
          return -1;
        }
        if (!aIsExact && bIsExact) {
          console.log(`Ava: ${b.title} is exact match!`);
          return 1;
        }
        
        // If both are exact or both aren't, prefer fewer participants
        return aParticipantCount - bParticipantCount;
      });
      
      const bestMatch = sortedMatches[0];
      console.log('Ava: Found best match:', bestMatch.title, 
        'with', bestMatch.participants?.length, 'participants');
      return bestMatch;
    }
    
    // Fall back to partial matching (original logic)
    // First, try to find exact matches
    for (const term of searchTerms) {
      const exactMatch = conversations.find(conv => 
        conv.title.toLowerCase() === term.toLowerCase()
      );
      if (exactMatch) {
        console.log('Ava: Found exact match:', exactMatch.title);
        return exactMatch;
      }
    }
    
    // Then try partial matches (name contains the search term)
    for (const term of searchTerms) {
      const partialMatch = conversations.find(conv => 
        conv.title.toLowerCase().includes(term.toLowerCase())
      );
      if (partialMatch) {
        console.log('Ava: Found partial match:', partialMatch.title);
        return partialMatch;
      }
    }
    
    // Finally, try word-based matching (any word in the name matches)
    for (const term of searchTerms) {
      const wordMatch = conversations.find(conv => {
        const convWords = conv.title.toLowerCase().split(' ');
        return convWords.some(word => word.includes(term.toLowerCase()));
      });
      if (wordMatch) {
        console.log('Ava: Found word match:', wordMatch.title);
        return wordMatch;
      }
    }
    
    return null;
  };

  const getAvaResponse = async (query: string): Promise<string> => {
    const lowerQuery = query.toLowerCase();
    const userId = auth.currentUser?.uid;
    const db = getFirestore();

    if (!userId) {
      return "Please log in to use AI features.";
    }

    // Summarize conversation
    if (lowerQuery.includes('summarize')) {
      // Use enhanced name recognition to find conversations
      const convoMatch = findConversationByName(query);

      if (convoMatch) {
        try {
          console.log('Ava: Summarizing conversation:', convoMatch.title, 'ID:', convoMatch.id);
          const result = await aiService.summarizeThread(convoMatch.id);
          console.log('Ava: Summarization result:', result);
          return `📝 Summary of ${convoMatch.title}:\n\n${result.summary}\n\nMessage Count: ${result.messageCount}`;
        } catch (error: any) {
          console.error('Ava: Summarization error details:', {
            error: error,
            message: error.message,
            code: error.code,
            details: error.details
          });
          return `Sorry, I couldn't summarize that conversation. Error: ${error.message || error.code || 'Unknown error'}`;
        }
      } else if (conversations.length > 0) {
        // Show list of conversations to choose from
        const convoList = conversations
          .slice(0, 5)
          .map((c, i) => `${i + 1}. ${c.title}`)
          .join('\n');
        return `I couldn't find a conversation with that name. Here are your active conversations:\n\n${convoList}\n\nTry saying the exact name from the list above, or just say "summarize" to see all options!`;
      } else {
        return "You don't have any active conversations yet. Start chatting with someone first!";
      }
    }

    // Action items query
    if (lowerQuery.includes('action') || lowerQuery.includes('task') || lowerQuery.includes('to do') || lowerQuery.includes('todo')) {
      try {
        const actionItemsSnapshot = await getDocs(
          firestoreQuery(
            collection(db, 'action_items'),
            where('status', '==', 'pending'),
            where('assigneeId', '==', userId),
            orderBy('createdAt', 'desc')
          )
        );

        if (actionItemsSnapshot.empty) {
          return "🎉 You don't have any pending action items!";
        }

        const items = actionItemsSnapshot.docs.map(doc => doc.data());
        const itemsList = items.map((item: any, i: number) => {
          let itemText = `${i + 1}. ${item.task}`;
          if (item.deadline) {
            try {
              const deadlineDate = item.deadline?.toDate?.()
                ? item.deadline.toDate()
                : new Date(item.deadline);
              if (!isNaN(deadlineDate.getTime())) {
                const dueDate = deadlineDate.toLocaleDateString();
                itemText += ` (Due: ${dueDate})`;
              }
            } catch (e) {
              // Skip deadline if parsing fails
            }
          }
          return itemText;
        }).join('\n');

        return `📋 Your Action Items:\n\n${itemsList}\n\n💡 Tap "Action Items" in the Ava tab to see more details and mark items complete!`;
      } catch (error: any) {
        console.error('Error fetching action items:', error);
        return `Sorry, I couldn't fetch your action items: ${error.message}`;
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
        const response = await aiService.smartSearch(searchTerm);
        if (!response || response.results.length === 0) {
          return `I couldn't find any messages matching "${searchTerm}". Try different keywords!`;
        }

        const results = response.results.slice(0, 5); // Limit to 5 results
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

    // Name-based queries (new feature)
    else if (lowerQuery.includes('who is') || lowerQuery.includes('tell me about')) {
      const extractedNames = extractNamesFromQuery(query);
      const nameToSearch = extractedNames.fullName || extractedNames.firstName;
      
      if (!nameToSearch) {
        return "I need a name to search for. Try 'Who is John?' or 'Tell me about Sarah'";
      }

      try {
        // Search for messages mentioning this person
        const response = await aiService.smartSearch(nameToSearch);
        if (!response || response.results.length === 0) {
          return `I couldn't find any messages mentioning ${nameToSearch}. They might not be in your conversation history.`;
        }

        const results = response.results.slice(0, 10); // Limit to 10 results
        
        // Group results by conversation
        const byConversation = results.reduce((acc, result) => {
          if (!acc[result.conversationId]) {
            acc[result.conversationId] = [];
          }
          acc[result.conversationId].push(result);
          return acc;
        }, {} as Record<string, typeof results>);

        const conversationInfo = Object.entries(byConversation)
          .map(([convoId, messages]) => {
            const convo = conversations.find(c => c.id === convoId);
            const convoName = convo ? convo.title : 'Unknown conversation';
            const messageCount = messages.length;
            const latestMessage = messages[0]; // Results are sorted by relevance
            
            return `**${convoName}** (${messageCount} mentions)**\n"${latestMessage.text}" - ${latestMessage.sender}`;
          })
          .join('\n\n');

        return `👤 **Information about ${nameToSearch}:**\n\n${conversationInfo}`;
      } catch (error: any) {
        return `Sorry, I couldn't find information about ${nameToSearch}: ${error.message}`;
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
      return "I can help you with:\n\n1. 📝 **Summarize conversations** - Say 'summarize [conversation name]' or 'summarize my conversation with Jodie'\n2. 👤 **Find information about people** - Say 'Who is John?' or 'Tell me about Sarah'\n3. 🔍 **Search messages** - Say 'search for [topic]'\n4. ✅ **View action items** - Go to Action Items tab\n5. 📌 **Track decisions** - Go to Decisions tab\n6. 🔴 **Priority messages** - I detect them automatically!\n\nI can recognize first names, last names, and full names from your conversation history!";
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
            <TouchableOpacity
              key={message.id}
              style={[
                styles.messageBubble,
                message.role === 'user'
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}
              onLongPress={() => handleCopyMessage(message.content)}
              activeOpacity={0.7}>
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
                <View style={styles.messageActions}>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => handleCopyMessage(message.content)}>
                    <Ionicons name="copy-outline" size={16} color="#999" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
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
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    maxHeight: 100,
    paddingVertical: 12,
    textAlignVertical: 'top',
    minHeight: 40,
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
  messageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    opacity: 0.7,
  },
  copyButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});

